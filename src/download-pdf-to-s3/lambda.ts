// event data:
// {
//   "Records": [
//     {
//       "eventID": "4cff18fbf6c5a7fb9db7008add5af874",
//       "eventName": "INSERT",
//       "eventVersion": "1.1",
//       "eventSource": "aws:dynamodb",
//       "awsRegion": "us-west-2",
//       "dynamodb": {
//         "ApproximateCreationDateTime": 1582405136,
//         "Keys": {
//           "itemId": {
//             "S": "5055310"
//           }
//         },
//         "NewImage": {
//           "date": {
//             "S": "02/03/2020"
//           },
//           "itemId": {
//             "S": "5055310"
//           },
//           "documentType": {
//             "S": "WELL ABANDONMENT REPORT (INTENT)"
//           },
//           "downloadUrl": {
//             "S": "http://ogccweblink.state.co.us/DownloadDocumentPDF.aspx?DocumentId=5055310"
//           }
//         },
//         "SequenceNumber": "89300000000054786958328",
//         "SizeBytes": 169,
//         "StreamViewType": "NEW_IMAGE"
//       },
//       "eventSourceARN": "arn:aws:dynamodb:us-west-2:839811712080:table/cogcc-pdf-urls/stream/2020-02-22T20:53:55.247"
//     }
//   ]
// }

import * as http from "http";
import * as fs from "fs";
import * as AWS from "aws-sdk";
const s3obj = new AWS.S3();
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";

// // // //

// Downloads a file from a URL and writes it to `./tmp/filename
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    console.log("created file write stream: " + dest);

    // Fetches URL using HTTP
    http.get(url, (response) => {
      // Logs downloaded file message
      console.log("downloaded file: " + url);

      // Pipes response to file
      response.pipe(file);

      // Defines callback for stream "finish" event
      file.on("finish", function () {
        // Logs wrote-to-file message
        console.log("wrote to file: " + dest);

        // Closes file stream and resolves promise
        file.close();
        resolve();
      });
    });
  });
}

// // // //

export const handler = async (event: any = {}): Promise<void> => {
  // Logs start message + S3_BUCKET_NAME
  console.log("download-file --> START");
  console.log(`writing to S3 bucket: ${S3_BUCKET_NAME}`);

  // Debug event input
  console.log(JSON.stringify(event, null, 4));

  // Pulls newItem from event
  const newItem = event["Records"][0]["dynamodb"]["NewImage"];
  if (!newItem) {
    return;
  }

  // Pulls downloadUrl from newItem
  const downloadUrl = newItem["downloadUrl"]["S"];
  const documentId = newItem["itemId"]["S"];
  if (!downloadUrl) {
    return;
  }

  // Defines filename - used to save locally to lambda (in /tmp) AND in S3 bucket
  const filename = documentId + ".pdf";
  const filepath = "/tmp/" + filename;

  // Logs downloadUrl
  console.log(`downloadUrl: ${downloadUrl}`);
  console.log(`documentId: ${documentId}`);
  console.log(`filepath: ${filepath}`);

  // Downloads file to /tmp
  await downloadFile(downloadUrl, filepath);

  // Saves new file to S3
  s3obj
    .upload({
      Bucket: S3_BUCKET_NAME,
      Key: documentId + ".pdf",
      Body: fs.readFileSync(filepath),
    })
    .send((err, data) => {
      console.log(err, data);
      // Logs error
      if (err) {
        console.log(`download-file --> ERROR`);
        console.log(err);
        return;
      }
      console.log(`download-file --> SUCCESS --> ${filename}`);
    });
};
