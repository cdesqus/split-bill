import { GoogleGenerativeAI } from "@google/generative-ai";
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n=== GEMINI API KEY TESTER ===\n");
console.log("Please go to https://aistudio.google.com/app/apikey");
console.log("Create a NEW API Key (do not use an old one).");
console.log("Copy it carefully.\n");

rl.question('Paste your API Key here: ', async (apiKey) => {
    apiKey = apiKey.trim();
    if (!apiKey) {
        console.log("❌ Key cannot be empty.");
        rl.close();
        return;
    }

    console.log(`\nTesting Key: ${apiKey.slice(0, 10)}...`);

    try {
        // Method 1: Direct HTTP Check (Most reliable for validity)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            const errText = await response.text();
            console.error("\n❌ FAILED. This API Key is NOT working.");
            console.error(`Server Response: ${response.status} ${response.statusText}`);
            console.error(`Details: ${errText}`);
            console.error("\nPOSSIBLE CAUSES:");
            console.error("1. You copied the key incorrectly (check for spaces).");
            console.error("2. The key is deleted/expired in Google AI Studio.");
            console.error("3. You mistakenly copied a Project ID or Client ID instead of the API Key.");
        } else {
            const data = await response.json();
            console.log("\n✅ SUCCESS! This API Key is VALID.");
            console.log(`Available Models: ${data.models?.length || 0}`);

            console.log("\nTop 5 Models:");
            (data.models || []).slice(0, 5).forEach(m => console.log(`- ${m.name.replace('models/', '')}`));

            const hasFlash = data.models.find(m => m.name.includes('gemini-1.5-flash'));
            if (hasFlash) {
                console.log("\n✨ GOOD NEWS: 'gemini-1.5-flash' is available for this key.");
            } else {
                console.log("\n⚠️ WARNING: 'gemini-1.5-flash' is NOT in the list. You may need to enable it.");
            }
        }
    } catch (error) {
        console.error("Network Error:", error.message);
    }

    rl.close();
});
