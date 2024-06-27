import { executeCommonStackRoutines } from './common-stack-routines'
import { CloudFormationClient, S3Client } from './shared/clients'

executeCommonStackRoutines()

async function main(): Promise<void> {
  const cloudFormationClient = new CloudFormationClient()
  const s3Client = new S3Client()

  await cloudFormationClient.createStack()
  await s3Client.uploadReactBuildToS3()
}

main()
