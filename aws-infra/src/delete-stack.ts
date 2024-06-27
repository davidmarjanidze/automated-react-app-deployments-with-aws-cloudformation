import { executeCommonStackRoutines } from './common-stack-routines'
import { CloudFormationClient } from './shared/clients'

executeCommonStackRoutines()

async function main(): Promise<void> {
  const cloudFormationClient = new CloudFormationClient()

  await cloudFormationClient.deleteStack()
}

main()
