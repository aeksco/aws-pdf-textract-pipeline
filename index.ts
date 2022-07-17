import { App } from "aws-cdk-lib";
import { PdfTextractPipeline } from "./src/stack";

// // // //

// Defines new CDK App
const app = new App();

// Instantiates the PdfTextractPipeline
new PdfTextractPipeline(app, "PdfTextractPipeline");
app.synth();
