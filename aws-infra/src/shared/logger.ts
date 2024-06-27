class Logger {
  log(message: any): void {
    console.log(message)
  }

  info(message: any): void {
    console.log('\x1b[33m' + message + '\x1b[0m')
  }

  success(message: any): void {
    console.log('\x1b[32m' + message + '\x1b[0m')
  }

  error(message: any): void {
    console.log('\x1b[31m' + message + '\x1b[0m')
  }
}

export const logger = new Logger()
