import * as AWS from "aws-sdk";
const textract = new AWS.Textract({ region: "us-west-2" });
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";
const SNS_ROLE_ARN = process.env.SNS_ROLE_ARN || "";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";

// TOOD - replace `any` with correct event type
export const handler = async (event: any = {}): Promise<any> => {
  // Logs starting message + event
  console.log("send-pdf-to-textract -> start");
  console.log(JSON.stringify(event, null, 4));

  // Pulls filename from event
  const filename = event["Records"][0]["s3"]["object"]["key"];

  // Short-circuit if filename isn't defined
  if (!filename) {
    console.log("ERROR - no filename found in S3 event");
    return;
  }

  // Logs filename
  console.log("filename: " + filename);

  // Defines params for Textract API call
  const params: AWS.Textract.StartDocumentAnalysisRequest = {
    DocumentLocation: {
      S3Object: {
        Bucket: S3_BUCKET_NAME,
        Name: filename
      }
    },
    FeatureTypes: ["FORMS"],
    NotificationChannel: {
      RoleArn: SNS_ROLE_ARN,
      SNSTopicArn: SNS_TOPIC_ARN
    }
  };

  // Log startDocumentAnalysis param
  console.log("startDocumentAnalysis params");
  console.log(params);

  // Invoke Textract.startDocumentAnalysis
  await new Promise(resolve => {
    return textract.startDocumentAnalysis(params, function(err, data) {
      // Logs error state
      console.log("startDocumentAnalysis - err");
      console.log(err);

      // Logs success state
      console.log("startDocumentAnalysis - data");
      console.log(data);

      // Resolves with data
      resolve(data);
    });
  });

  // Logs shutdown message
  console.log("send-pdf-to-textract -> shutdown");
  return;
};
