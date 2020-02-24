import * as chromium from "chrome-aws-lambda";
import * as AWS from "aws-sdk";
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";

// // // //

const fetchUrl =
  "http://ogccweblink.state.co.us/Results.aspx?DocName=WELL%20ABANDONMENT%20REPORT%20(INTENT)&DocDate=02/03/2020";

// export const handler = async (): Promise<any> => {
export const handler = async (
  event: any = {},
  context: any = {}
): Promise<any> => {
  // Log statement to ensure it's loading
  console.log("RUN LAMBDA!");
  console.log(TABLE_NAME);
  console.log(PRIMARY_KEY);

  // // // //
  // // // //

  let result = null;
  let browser = null;

  try {
    // Defines browser
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });

    // Defines page
    let page = await browser.newPage();

    // Set downloads directory
    // await page._client.send("Page.setDownloadBehavior", {
    //   behavior: "allow",
    //   downloadPath: "./"
    // });

    // Navigate to page, wait until dom content is loaded
    await page.goto(event.url || fetchUrl, {
      waitUntil: "domcontentloaded"
    });

    // Gets ALL urls
    // @ts-ignore
    let allHrefs = await page.$$eval("a", as => as.map(a => a.href));

    // Gets Download URLS
    let downloadHrefs = allHrefs.filter(a => a.includes("DownloadDocumentPDF"));

    // // Logs downloadHrefs
    console.log("downloadHrefs");
    console.log(downloadHrefs);

    // // // //
    // DYNAMO DB CODE
    await Promise.all(
      downloadHrefs.map(
        (downloadUrl: string): Promise<any> => {
          // Pulls documentId from downloadUrl
          const documentId: string = String(
            downloadUrl.split("DocumentId=").pop()
          );

          // Defines the item we're inserting into the database
          const item: any = {
            [PRIMARY_KEY]: documentId,
            documentType: "WELL ABANDONMENT REPORT (INTENT)",
            date: "02/03/2020",
            downloadUrl: downloadUrl
          };

          // Defines the params for db.put
          const params = {
            TableName: TABLE_NAME,
            Item: item
          };

          // Inserts the record into the DynamoDB table
          return db.put(params).promise();
        }
      )
    );

    // Logs "DONE" statement
    console.log("DONE");
  } catch (error) {
    return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return context.succeed(result);
};

// // // //
