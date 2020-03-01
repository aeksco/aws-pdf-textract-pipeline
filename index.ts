import * as cdk from "@aws-cdk/core";
import { PdfTextractPipeline } from "./src/stack";

// // // //

// Defines new CDK App
const app = new cdk.App();

// Instantiates the PdfTextractPipeline
new PdfTextractPipeline(app, "PdfTextractPipeline");
app.synth();
