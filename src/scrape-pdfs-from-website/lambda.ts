import * as chromium from "chrome-aws-lambda";
import * as AWS from "aws-sdk";
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";

// // // //

/**
 * buildFetchUrl
 * Builds a url to the page with all the PDF download URLs
 */
function buildFetchUrl(): string {
  // The URL from which the PDF download URLs are being fetched
  const baseUrl =
    "http://ogccweblink.state.co.us/Results.aspx?DocName=WELL%20ABANDONMENT%20REPORT%20(INTENT)&DocDate=02/03/2020";

  // Returns base URL with date param
  return baseUrl;
}

// // // //

export const handler = async (
  event: any = {},
  context: any = {}
): Promise<any> => {
  // Log start message
  console.log("scrape-pdfs-from-website -> start");
  console.log(event);

  // Define
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

    // Gets fetchUrl for puppeteer
    // This is the page with all the PDF download URLs
    const fetchUrl: string = buildFetchUrl();

    // Navigate to page, wait until dom content is loaded
    await page.goto(fetchUrl, {
      waitUntil: "domcontentloaded"
    });

    // Gets ALL urls
    // @ts-ignore
    let allHrefs = await page.$$eval("a", as => as.map((a: Element) => a.href));

    // Gets Download URLS
    let downloadUrls = allHrefs.filter(a => a.includes("DownloadDocumentPDF"));

    // Logs downloadUrls
    console.log("downloadUrls");
    console.log(downloadUrls);

    // Insert all downloadURLs into DynamoDO
    await Promise.all(
      downloadUrls.map(
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
  } catch (error) {
    return context.fail(error);
  } finally {
    // Close the puppeteer browser
    if (browser !== null) {
      await browser.close();
    }
  }

  // Logs "shutdown" statement
  console.log("scrape-pdfs-from-website -> shutdown");
  return context.succeed(result);
};
