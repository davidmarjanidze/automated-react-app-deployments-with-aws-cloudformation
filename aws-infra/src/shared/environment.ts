import { config } from "dotenv";
config();

interface IEnvironment {
  aws: {
    profile: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    defaultRegion: string;
    cloudFormation: {
      stackName: string;
    };
    s3: {
      bucketName: string;
    };
  };
  reactProject: {
    fullPath: string;
    buildDirFullPath: string;
  };
}

export const environment: IEnvironment = {
  aws: {
    profile: process.env.AWS_PROFILE as string,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    sessionToken: process.env.AWS_SESSION_TOKEN as string,
    defaultRegion: process.env.AWS_DEFAULT_REGION as string,
    cloudFormation: {
      stackName: process.env.CLOUDFORMATION_STACK_NAME as string,
    },
    s3: {
      bucketName: `demo-web-app-${process.env.AWS_DEFAULT_REGION as string}`,
    },
  },
  reactProject: {
    fullPath: process.env.REACT_PROJECT_FULL_PATH as string,
    buildDirFullPath: process.env.REACT_PROJECT_BUILD_DIR_FULL_PATH as string,
  },
};
