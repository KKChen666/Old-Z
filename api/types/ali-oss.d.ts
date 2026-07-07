declare module 'ali-oss' {
  export interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    [key: string]: any;
  }

  export interface PutObjectResult {
    name: string;
    url: string;
    res: {
      status: number;
      statusCode: number;
      headers: Record<string, string>;
    };
  }

  export interface DeleteObjectResult {
    res: { status: number; statusCode: number };
  }

  export default class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer | Blob | string): Promise<PutObjectResult>;
    delete(name: string): Promise<DeleteObjectResult>;
    signatureUrl(name: string, options?: { expires?: number }): string;
    [key: string]: any;
  }
}
