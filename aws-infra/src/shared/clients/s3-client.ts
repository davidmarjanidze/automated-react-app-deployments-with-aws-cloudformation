import { execSync } from 'node:child_process'
import { readdirSync, lstatSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { AWSError, S3 } from 'aws-sdk'
import { PromiseResult } from 'aws-sdk/lib/request'
import { DeleteObjectsOutput } from 'aws-sdk/clients/s3'

import { environment } from '../environment'
import { logger } from '../logger'

const SUFFIX_MAP_TO_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.woff2': 'font-woff2',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-sfnt'
}

export class S3Client {
  s3Client = new S3()

  buildReactProject(): void {
    logger.log(
      execSync(`npm run build`, {
        cwd: environment.reactProject.fullPath
      }).toString()
    )
  }

  async uploadBuildToS3(): Promise<void> {
    const upload = async (directoryOrFile: string) => {
      if (lstatSync(path.join(directoryOrFile)).isDirectory())
        readdirSync(directoryOrFile).forEach(
          async (content) => await upload(path.join(directoryOrFile, content))
        )
      else {
        const fileExtension = `.${directoryOrFile.split('.').at(-1)!}`
        const contentType = SUFFIX_MAP_TO_MIME_TYPES[fileExtension]

        if (!contentType)
          throw new Error(
            `Mime type for ${fileExtension} extension is not defined`
          )

        this.s3Client.upload(
          {
            Bucket: environment.aws.s3.bucketName,
            Key: directoryOrFile.split('build')[1].slice(1),
            Body: readFileSync(directoryOrFile),
            ContentType: contentType
          },
          (err) => {
            if (err) logger.error(err)
          }
        )
      }
    }

    await upload(environment.reactProject.buildDirFullPath)
  }

  async bucketExists(): Promise<boolean> {
    return await this.s3Client
      .headBucket({ Bucket: environment.aws.s3.bucketName })
      .promise()
      .catch((error: AWSError) => {
        if (error.code === 'NotFound') return 'NotFound'
      })
      .then((data) => !(data === 'NotFound'))
  }

  async deleteObjectsFromS3(): Promise<
    undefined | PromiseResult<DeleteObjectsOutput, AWSError>
  > {
    const data = await this.s3Client
      .listObjectsV2({
        Bucket: environment.aws.s3.bucketName
      })
      .promise()

    if (data.Contents?.length)
      return await this.s3Client
        .deleteObjects({
          Bucket: environment.aws.s3.bucketName,
          Delete: {
            Objects: data.Contents.map((content) => ({
              Key: content.Key!
            }))
          }
        })
        .promise()
    else await Promise.resolve()
  }

  async uploadReactBuildToS3(): Promise<void> {
    logger.info('Building the react project')
    this.buildReactProject()
    logger.success('React project build success')

    logger.info('Deleting S3 contents')
    if (await this.bucketExists()) await this.deleteObjectsFromS3()
    logger.success('Deleted S3 contents')

    logger.info('Uploading build folder to S3')
    await this.uploadBuildToS3()
    logger.success('Uploaded build folder to S3')
  }
}
