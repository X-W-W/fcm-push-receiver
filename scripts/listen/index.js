import { listen } from "../../dist/index.js";

try {
    await listen();
    console.log("Connected");
} catch (error) {
    console.error("Error during notification listening");
    console.error(error instanceof Error ? error.message : error);
}
