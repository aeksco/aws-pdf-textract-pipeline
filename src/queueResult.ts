// {
//   "Records": [
//     {
//       "EventSource": "aws:sns",
//       "EventVersion": "1.0",
//       "EventSubscriptionArn": "arn:aws:sns:us-west-2:839811712080:LambdaCronExample-MyTopic86869434-GNU4OYHJJK2B:2835b150-7b7c-4701-b345-1a26aa997ba0",
//       "Sns": {
//         "Type": "Notification",
//         "MessageId": "a0fcdb52-33c5-5e75-a29d-8d9f16c6efa0",
//         "TopicArn": "arn:aws:sns:us-west-2:839811712080:LambdaCronExample-MyTopic86869434-GNU4OYHJJK2B",
//         "Subject": null,
//         "Message": "{\"JobId\":\"8ace6713ef0f85fbd88294d4f50b5063ad08052f93da760e98da55668f3e1148\",\"Status\":\"SUCCEEDED\",\"API\":\"StartDocumentTextDetection\",\"Timestamp\":1582506691353,\"DocumentLocation\":{\"S3ObjectName\":\"5055255.pdf\",\"S3Bucket\":\"lambdacronexample-cogccpdfdownloadsbucket93b40e01-1kn95iu6zt174\"}}",
//         "Timestamp": "2020-02-24T01:11:31.395Z",
//         "SignatureVersion": "1",
//         "Signature": "drLfHmCEegFSc4oLYO/5y8ouKkHQLEsDo2l9tFFFtUGTUcbnIhFHYvQfbTND9BxE8a18kZ+nDBHuLlNhF67oVW0B2I8oy3svlYc6oeRUcgg6wF8TqlPpBwsG+UCnP81OIjtcb0VutqeYonlg8EDuXYK/pPumDsQ1NIkKjfwncdLPJLsgiuZZOkkRnvui5qftLSRkXtI1EXdwhIIXNyU3jK0MhEWZ/69K2mpZRSkb1jy2nkfQi1zlhktF4AfQpq4bMVxaBTq36Hb4FXXpzcPO2CLN2XchAIszd4vDAiEy9oSKJIW0IxqY5bazk70/lCva+AaMHoUAUazHHXamOZC4nw==",
//         "SigningCertUrl": "https://sns.us-west-2.amazonaws.com/SimpleNotificationService-a86cb10b4e1f29c941702d737128f7b6.pem",
//         "UnsubscribeUrl": "https://sns.us-west-2.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-west-2:839811712080:LambdaCronExample-MyTopic86869434-GNU4OYHJJK2B:2835b150-7b7c-4701-b345-1a26aa997ba0",
//         "MessageAttributes": {}
//       }
//     }
//   ]
// }

// // // //

import * as AWS from "aws-sdk";
const db = new AWS.DynamoDB.DocumentClient();
const textract = new AWS.Textract({ region: "us-west-2" });
const TABLE_NAME = process.env.TABLE_NAME || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";
// const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";
// const SNS_ROLE_ARN = process.env.SNS_ROLE_ARN || "";
// const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
// const SQS_URL = process.env.SQS_URL || "";
// const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";
// const SNS_ROLE_ARN = process.env.SNS_ROLE_ARN || "";

export const handler = async (event: any = {}): Promise<any> => {
  console.log("QUEUE RESULT");
  // console.log(SNS_TOPIC_ARN);
  // console.log(SNS_ROLE_ARN);
  console.log(JSON.stringify(event, null, 4));
  // return;

  let JobId = "";
  try {
    JobId = event["Records"][0]["Sns"]["Message"];
    console.log("parsed jobid struct from event");
    console.log(JobId);
    console.log(JSON.parse(JobId));
    const jobIDStruct = JSON.parse(JobId);
    JobId = jobIDStruct["JobId"];
  } catch (e) {
    console.log("ERROR PARSING JOB ID");
    console.log(e);
  }

  // Log JobID
  console.log("JobId");
  console.log(JobId);

  var params: any = {
    JobId
    // MaxResults: 1
    // NextToken: "STRING_VALUE"
  };

  console.log(params);

  await new Promise(resolve => {
    // textract.getDocumentTextDetection(params, async function(
    textract.getDocumentAnalysis(params, async function(err: any, data: any) {
      console.log("err, err.stack");
      console.log(err);
      // an error occurred
      console.log("data"); // successful response
      console.log(data); // successful response
      resolve(data);

      // Defines the item we're inserting into the database
      const item: any = {
        [PRIMARY_KEY]: JobId,
        data
      };

      // Defines the params for db.put
      const dynamoParams = {
        TableName: TABLE_NAME,
        Item: item
      };

      console.log("dynamoParams");
      console.log(dynamoParams);

      // Inserts the record into the DynamoDB table
      // TODO - wrap this call to DynamoDB in try/catch
      try {
        await db.put(dynamoParams).promise();
      } catch (e) {
        console.log("ERROR INSERTING DATA INTO DYNAMO DB");
        console.log(e);
      }
      console.log("Inserted into DynamoDB");
    });
  });
};
