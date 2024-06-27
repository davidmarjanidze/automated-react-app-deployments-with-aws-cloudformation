import AWS from 'aws-sdk'
import { environment } from './shared/environment'

export function executeCommonStackRoutines(): void {
  AWS.config.update({ region: environment.aws.defaultRegion })
}
