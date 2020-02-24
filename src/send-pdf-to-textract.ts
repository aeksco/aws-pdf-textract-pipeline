// "Records": [
//   {
//     "eventVersion": "2.1",
//     "eventSource": "aws:s3",
//     "awsRegion": "us-west-2",
//     "eventTime": "2020-02-22T22:12:23.990Z",
//     "eventName": "ObjectCreated:Put",
//     "userIdentity": {
//       "principalId": "AWS:AROA4HCFNYRIOZF4TPIG7:LambdaCronExample-fileDownloaderLambdaFunction1D9C-1XPL2Z2WKQXZE"
//     },
//     "requestParameters": {
//       "sourceIPAddress": "52.27.200.91"
//     },
//     "responseElements": {
//       "x-amz-request-id": "8086B5C82D6D010A",
//       "x-amz-id-2": "+bofWAYX2/WJO3i3QWiaU0TgKvfln86JUlW9lG87Pi1z37UH9yxoURHPSWQ8AiMlcgZ4kpploH5yqTjOgukucvDKLLB4nLDD"
//     },
//     "s3": {
//       "s3SchemaVersion": "1.0",
//       "configurationId": "OGY4OTUzOWUtMjQwNC00NmQwLWI1MjEtMzU4ODg1MzI2MjQ4",
//       "bucket": {
//         "name": "lambdacronexample-cogccpdfdownloadsbucket93b40e01-b4wr4268102r",
//         "ownerIdentity": {
//           "principalId": "A3IRW0AE284GDD"
//         },
//         "arn": "arn:aws:s3:::lambdacronexample-cogccpdfdownloadsbucket93b40e01-b4wr4268102r"
//       },
//       "object": {
//         "key": "5055298.pdf",
//         "size": 27,
//         "eTag": "f9c28374e5680f08ac81ac2b3b69b598",
//         "sequencer": "005E51A7489537E7B4"
//       }
//     }
//   }
// ]

// // // //

import * as AWS from "aws-sdk";
const db = new AWS.DynamoDB.DocumentClient();
// const textract = new AWS.Textract();
const TABLE_NAME = process.env.TABLE_NAME || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";
const SNS_ROLE_ARN = process.env.SNS_ROLE_ARN || "";

export const handler = async (event: any = {}): Promise<any> => {
  console.log("SEND FILE TO TEXTRACT");
  console.log(SNS_TOPIC_ARN);
  console.log(SNS_ROLE_ARN);

  console.log(JSON.stringify(event, null, 4));

  // Pulls filename from event
  const filename = event["Records"][0]["s3"]["object"]["key"];

  // Short-circuit if filename isn't defined
  if (!filename) {
    console.log("ERROR - filename");
  }

  console.log("filename: " + filename);

  // Defines params for Textract API call
  const textractParams: AWS.Textract.AnalyzeDocumentRequest = {
    Document: {
      S3Object: {
        Bucket: S3_BUCKET_NAME,
        Name: filename
        // Version: "STRING_VALUE"
      }
    },
    FeatureTypes: ["TABLES", "FORMS"]
  };

  // Debug AWS Textract params
  console.log("textractParams");
  console.log(JSON.stringify(textractParams, null, 4));

  // // // //
  // // // //

  // Add job to queue

  // // // //
  // // // //

  // Detect the document's text with Textract
  // await new Promise(resolve => {
  //   textract.analyzeDocument(textractParams, async (err: any, data: any) => {
  //     console.log("DONE ANALYZING DOCUMENT");
  //     console.log(err);
  //     console.log(data);

  //     if (err) {
  //       console.log(err, err.stack);
  //       return;
  //     }

  //     // Debug Textract response
  //     console.log("Textract Response");
  //     console.log(JSON.stringify(data, null, 4));

  //     // Defines the item we're inserting into the database
  //     const item: any = {
  //       [PRIMARY_KEY]: filename.replace(".pdf", ""),
  //       // primary_contact_name: "John Doe"
  //       data: {
  //         ...data
  //       }
  //     };

  //     // Defines the params for db.put
  //     const dynamoParams = {
  //       TableName: TABLE_NAME,
  //       Item: item
  //     };

  //     // Inserts the record into the DynamoDB table
  //     await db.put(dynamoParams).promise();
  //     return resolve();
  //   });
  // });

  // return;

  // // // //
  // // // //
  // // // //
  // // // //

  // Defines the item we're inserting into the database
  const item: any = {
    [PRIMARY_KEY]: Math.random().toString(),
    primary_contact_name: "John Doe"
  };

  // Defines the params for db.put
  const dynamoParams = {
    TableName: TABLE_NAME,
    Item: item
  };

  // Inserts the record into the DynamoDB table
  return db.put(dynamoParams).promise();
};
