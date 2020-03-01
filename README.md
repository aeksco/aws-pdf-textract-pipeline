# aws-pdf-textract-pipeline

:mag: Data pipeline for crawling PDFs from the Web and transforming their contents into structured data using [AWS Textract](https://aws.amazon.com/textract/). Built with AWS CDK + TypeScript.

This is an example data pipeline that illustrates one possible approach for large-scale serverless PDF processing - it should serve as a good foundation to modify for your own purposes.

![Example Extension Popup](https://i.imgur.com/3F89JQK.png "Example Extension Popup")

<!-- https://cloudcraft.co/view/e135397e-a673-411e-9ee7-05a5618052b2?key=R-OLiwplnkA9dtQxtkVqOw&interactive=true&embed=true -->

**Getting Started**

Run the following commands to install dependencies, build the CDK stack, and deploy the CDK Stack to AWS.

```
yarn install
yarn build
cdk bootstrap
cdk deploy
```

### Overview

The following is an overview of each process performed by this CDK stack.

1. **Scrape PDF download URLs from a website**

   Scraping data from the [COGCC]() website.

2. **Store PDF download URL in DynamoDB**

   ![Example Extension Popup](https://i.imgur.com/bmFJGDW.png "Example Extension Popup")

3. **Download the PDF to S3**

   A lambda fires off when a new PDF download URL has been created in DynamoDB.

4. **Process the PDF with AWS Textract**

   Another lambda fires off when a PDF has been downloaded to the S3 bucket.

5. **Process the AWS Textract results**

   When an SNS event is detected from AWS Textract, a lambda is fired off to process the result.

6. **Save the processed Textract result to DynamoDB.**

   After the full result is pruned down the the desired datastructure, we save the data in DynamoDB.
   ![Example Extension Popup](https://i.imgur.com/HkTtLmi.png "Example Extension Popup")

### Scripts

- `yarn install` - installs dependencies
- `yarn build` - builds the production-ready CDK Stack
- `yarn test` - runs Jest
- `cdk bootstrap` - bootstraps AWS Cloudformation for your CDK deploy
- `cdk deploy` - deploys the CDK stack to AWS

**Notes**

- Includes tests with Jest.

- Recommended to use `Visual Studio Code` with the `Format on Save` setting turned on.

**Built with**

- [TypeScript](https://www.typescriptlang.org/)
- [Jest](https://jestjs.io)
- [Puppeteer](https://jestjs.io)
- [AWS CDK](https://aws.amazon.com/cdk/)
- [AWS Lambda](https://aws.amazon.com/lambda/)
- [AWS SNS](https://aws.amazon.com/sns/)
- [AWS DynamoDB](https://aws.amazon.com/dynamodb/)
- [AWS S3](https://aws.amazon.com/s3/)

**Additional Resources**

- [CDK API Reference](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-construct-library.html)
- [Puppeteer](https://github.com/puppeteer/puppeteer)
- [Puppeteer Lambda](https://github.com/alixaxel/chrome-aws-lambda)
- [CDK TypeScript Reference](https://docs.aws.amazon.com/cdk/api/latest/typescript/api/index.html)
- [CDK Assertion Package](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/assert)
- [Textract Pricing Chart](https://aws.amazon.com/textract/pricing/)
- [awesome-cdk repo](https://github.com/eladb/awesome-cdk)
