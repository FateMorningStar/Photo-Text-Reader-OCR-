// Get HTML elements
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const extractButton = document.getElementById("extractButton");
const textOutput = document.getElementById("textOutput");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const clearButton = document.getElementById("clearButton");
const statusMessage = document.getElementById("statusMessage");

// Store selected image
let selectedImage = null;
let previewURL = null;

// IMAGE SELECTION AND PREVIEW

imageInput.addEventListener("change", function () {
    const file = imageInput.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        statusMessage.textContent =
            "Please select a valid image.";

        imageInput.value = "";
        return;
    }

    selectedImage = file;

    // Remove previous preview URL
    if (previewURL) {
        URL.revokeObjectURL(previewURL);
    }

    // Create a preview for the selected image
    previewURL = URL.createObjectURL(file);

    imagePreview.src = previewURL;
    imagePreview.hidden = false;

    // Enable OCR button
    extractButton.disabled = false;

    // Clear previous extracted text
    textOutput.value = "";

    statusMessage.textContent =
        "Image uploaded. Ready to extract text.";
});


// IMAGE PREPROCESSING
// Preserve the original colors and grayscale

function preprocessImage(imageFile) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const imageURL = URL.createObjectURL(imageFile);

        image.onload = function () {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            // Enlarge the image moderately
            // Avoid creating an excessively large canvas
            const scale = Math.min(
                2,
                3000 / Math.max(image.width, image.height)
            );

            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);

            // Draw the image without changing its colors
            context.drawImage(
                image,
                0,
                0,
                canvas.width,
                canvas.height
            );

            URL.revokeObjectURL(imageURL);

            resolve(canvas);
        };

        image.onerror = function () {
            URL.revokeObjectURL(imageURL);

            reject(
                new Error("Could not load the selected image.")
            );
        };

        image.src = imageURL;
    });
}
// OCR TEXT EXTRACTION

extractButton.addEventListener("click", async function () {
    if (!selectedImage) {
        statusMessage.textContent =
            "Please upload an image first.";

        return;
    }

    extractButton.disabled = true;

    try {
        statusMessage.textContent =
            "Preparing image...";

        // Prepare image for OCR
        const processedImage =
            await preprocessImage(selectedImage);

        statusMessage.textContent =
            "Reading image...";

        // Recognize text with Tesseract.js
        const result = await Tesseract.recognize(
            processedImage,
            "eng",
            {
                logger: function (message) {
                    if (message.status === "recognizing text") {
                        const progress = Math.round(
                            message.progress * 100
                        );

                        statusMessage.textContent =
                            `Extracting text... ${progress}%`;
                    }
                },

                // Automatically analyze the page layout
                tessedit_pageseg_mode:
                    Tesseract.PSM.AUTO
            }
        );

        // Clean up unnecessary spaces and blank lines
        const cleanedText = result.data.text
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        // Display extracted text
        textOutput.value = cleanedText;

        statusMessage.textContent =
            "Extraction complete. Review the text for errors.";

    } catch (error) {
        console.error("OCR Error:", error);

        statusMessage.textContent =
            "Unable to extract text. Try another image.";

    } finally {
        extractButton.disabled = false;
    }
});

// COPY THE EXTRACTED TEXT

copyButton.addEventListener("click", async function () {
    const text = textOutput.value;

    if (!text.trim()) {
        statusMessage.textContent =
            "There is no text to copy.";

        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        statusMessage.textContent =
            "Text copied to clipboard.";

    } catch (error) {
        // Fallback for browsers that block clipboard access
        textOutput.focus();
        textOutput.select();

        statusMessage.textContent =
            "Text selected. Copy it manually.";
    }
});

// DOWNLOAD TEXT AS TXT FILE

downloadButton.addEventListener("click", function () {
    const text = textOutput.value;

    if (!text.trim()) {
        statusMessage.textContent =
            "There is no text to download.";

        return;
    }

    const file = new Blob(
        [text],
        { type: "text/plain;charset=utf-8" }
    );

    const downloadURL = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = "extracted-text.txt";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadURL);

    statusMessage.textContent =
        "Text file downloaded.";
});

// CLEAR THE APPLICATION

clearButton.addEventListener("click", function () {
    // Reset file input
    imageInput.value = "";

    // Clear selected image
    selectedImage = null;

    // Remove preview URL
    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }

    // Reset image preview
    imagePreview.src = "";
    imagePreview.hidden = true;

    // Clear extracted text
    textOutput.value = "";

    // Disable extraction button
    extractButton.disabled = true;

    // Reset status
    statusMessage.textContent =
        "Upload an image to get started.";
});
