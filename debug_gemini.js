
import { GoogleGenerativeAI } from "@google/generative-ai";
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Please paste your Google Gemini API Key here: ', async (apiKey) => {
    apiKey = apiKey.trim();
    console.log(`\nTesting API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Intentionally request the specific model we use
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Checking model: gemini-1.5-flash...");

        // We can't easily check if a model exists without generating content or listing models strictly.
        // Let's list models available to this key.

        // Note: access directly via fetch to list models
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (!response.ok) {
            console.error("\n❌ API Error:");
            console.error(`Status: ${response.status} ${response.statusText}`);
            console.error("Details:", JSON.stringify(data, null, 2));
        } else {
            console.log("\n✅ API Key is Valid!");
            console.log("Available Models for this key:");
            if (data.models) {
                const modelNames = data.models.map(m => m.name.replace('models/', ''));
                modelNames.forEach(name => console.log(`- ${name}`));

                if (modelNames.includes('gemini-1.5-flash')) {
                    console.log("\nSUCCESS: 'gemini-1.5-flash' IS available for this key.");
                } else {
                    console.warn("\nWARNING: 'gemini-1.5-flash' was NOT found in the list. You might need to use one of the models listed above.");
                }
            } else {
                console.log("No models found.");
            }
        }

    } catch (error) {
        console.error("\n❌ Unexpected Error:", error.message);
    } finally {
        rl.close();
    }
});
