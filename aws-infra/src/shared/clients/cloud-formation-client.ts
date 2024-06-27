import { readFileSync } from 'node:fs'
import path from 'node:path'

import AWS, { AWSError } from 'aws-sdk'
import { PromiseResult } from 'aws-sdk/lib/request'
import {
  CreateStackOutput,
  UpdateStackOutput,
  DescribeStacksOutput,
  StackStatus
} from 'aws-sdk/clients/cloudformation'

import { S3Client } from './s3-client'
import { environment } from '../environment'
import { logger } from '../logger'

interface INoUpdates {
  noUpdates: boolean
}

export class CloudFormationClient {
  private readonly cloudFormationClient = new AWS.CloudFormation()
  private readonly s3Client = new S3Client()

  private getTemplateBody(): string {
    return readFileSync(
      path.join(__dirname, '../../../', 'cloudformation-template.yaml')
    ).toString()
  }

  private async stackExists(): Promise<any> {
    return await this.describeStack()
      .catch(() => ({}))
      .then((data: DescribeStacksOutput) =>
        data.Stacks?.length ? !!data.Stacks[0].StackId : false
      )
  }

  private async _createStack(): Promise<
    PromiseResult<CreateStackOutput, AWSError>
  > {
    return await this.cloudFormationClient
      .createStack({
        StackName: environment.aws.cloudFormation.stackName,
        TemplateBody: this.getTemplateBody(),
        OnFailure: 'ROLLBACK'
      })
      .promise()
  }

  private async _updateStack(): Promise<
    PromiseResult<UpdateStackOutput, AWSError>
  > {
    return await this.cloudFormationClient
      .updateStack({
        StackName: environment.aws.cloudFormation.stackName,
        TemplateBody: this.getTemplateBody()
      })
      .promise()
  }

  async describeStack(): Promise<
    PromiseResult<DescribeStacksOutput, AWSError>
  > {
    return await this.cloudFormationClient
      .describeStacks({
        StackName: environment.aws.cloudFormation.stackName
      })
      .promise()
  }

  async statusEquals(targetStatus: StackStatus): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const intervalId = setInterval(async () => {
        if (targetStatus === 'DELETE_COMPLETE' && !(await this.stackExists())) {
          resolve(true)
          return
        }

        const stack = await this.describeStack()
        const status = stack.Stacks?.length ? stack.Stacks[0].StackStatus : ''

        if (
          stack.Stacks?.length &&
          stack.Stacks[0].StackStatus === targetStatus
        ) {
          resolve(true)
          clearInterval(intervalId)
        } else if (
          status === 'CREATE_FAILED' ||
          status === 'ROLLBACK_IN_PROGRESS' ||
          status === 'UPDATE_FAILED' ||
          status === 'UPDATE_ROLLBACK_IN_PROGRESS' ||
          status === 'DELETE_FAILED'
        ) {
          reject(status)
          clearInterval(intervalId)
        }
      }, 5e3)
    })
  }

  async createStack(): Promise<void> {
    const stackExists = await this.stackExists()
    let createStackResponse:
      | undefined
      | PromiseResult<CreateStackOutput, AWSError> = undefined
    let updateStackResponse:
      | undefined
      | INoUpdates
      | PromiseResult<UpdateStackOutput, AWSError> = undefined

    if (stackExists) {
      {
        logger.info('Updating stack')
        updateStackResponse = await this._updateStack().catch((error) => {
          if (error.message.includes('No updates')) {
            logger.success(error.message)
            return { noUpdates: true }
          } else {
            logger.error(error)
            return error
          }
        })
      }
    } else {
      logger.info('Creating stack')
      createStackResponse = await this._createStack().catch((error) => {
        console.error('1')
        return undefined
      })
      logger.success('Created stack')
    }

    if (stackExists) {
      if ((updateStackResponse as INoUpdates)?.noUpdates) return

      logger.success('Updated stack')
      logger.info('Waiting for the CloudFormation resource update')
      await this.statusEquals('UPDATE_COMPLETE')
      logger.success('CloudFormation resource update completed')
    } else {
      logger.info('Waiting for the CloudFormation resource creation')
      await this.statusEquals('CREATE_COMPLETE')
      logger.success('CloudFormation resource creation completed')
    }
  }

  async deleteStack(): Promise<void> {
    logger.info('Deleting objects from S3')
    if (await this.s3Client.bucketExists())
      await this.s3Client.deleteObjectsFromS3()
    logger.success('Deleted objects from S3')

    logger.info('Deleting stack')
    await this.cloudFormationClient
      .deleteStack({ StackName: environment.aws.cloudFormation.stackName })
      .promise()
    logger.success('Stack successfully deleted')

    logger.info('Waiting for the CloudFormation resource deletion')
    await this.statusEquals('DELETE_COMPLETE')
    logger.success('CloudFormation resource deletion completed')
  }
}
