// Get HTML elements
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const extractButton = document.getElementById("extractButton");
const textOutput = document.getElementById("textOutput");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const clearButton = document.getElementById("clearButton");
const statusMessage = document.getElementById("statusMessage");

let selectedImage = null;

// Handle The image selection
imageInput.addEventListener("change", function () {
    const file = imageInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        statusMessage.textContent = "Please select a valid image.";
        return;
    }

    selectedImage = file;

    imagePreview.src = URL.createObjectURL(file);
    imagePreview.hidden = false;

    extractButton.disabled = false;
    textOutput.value = "";

    statusMessage.textContent = "Image uploaded. Ready to extract text.";
});

// Preprocess image for OCR
function preprocessImage(imageFile) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const imageURL = URL.createObjectURL(imageFile);

        image.onload = function () {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            // Enlarge The image to improve text recognition
            const scale = 2;

            canvas.width = image.width * scale;
            canvas.height = image.height * scale;

            context.drawImage(
                image,
                0,
                0,
                canvas.width,
                canvas.height
            );

            const imageData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

            const pixels = imageData.data;

            // Grayscale and contrast enhancement
            for (let i = 0; i < pixels.length; i += 4) {
                const red = pixels[i];
                const green = pixels[i + 1];
                const blue = pixels[i + 2];

                const gray =
                    0.299 * red +
                    0.587 * green +
                    0.114 * blue;

                const contrast = 1.5;

                let value =
                    contrast * (gray - 128) + 128;

                value = Math.max(0, Math.min(255, value));

                // Black-and-white threshold
                value = value > 170 ? 255 : 0;

                pixels[i] = value;
                pixels[i + 1] = value;
                pixels[i + 2] = value;
            }

            context.putImageData(imageData, 0, 0);

            URL.revokeObjectURL(imageURL);
            resolve(canvas);
        };

        image.onerror = function () {
            URL.revokeObjectURL(imageURL);
            reject(new Error("Could not load image."));
        };

        image.src = imageURL;
    });
}

// Extract text using OCR
extractButton.addEventListener("click", async function () {
    if (!selectedImage) {
        statusMessage.textContent = "Please upload an image first.";
        return;
    }

    extractButton.disabled = true;

    try {
        statusMessage.textContent = "Enhancing image...";

        const processedImage =
            await preprocessImage(selectedImage);

        statusMessage.textContent = "Reading image...";

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

                // Recognize the image as one text block
                tessedit_pageseg_mode:
                    Tesseract.PSM.SINGLE_BLOCK
            }
        );

        const cleanedText = result.data.text
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        textOutput.value = cleanedText;

        statusMessage.textContent =
            "Extraction complete. Review the text for errors.";

    } catch (error) {
        console.error(error);

        statusMessage.textContent =
            "Unable to extract text. Try a clearer image.";

    } finally {
        extractButton.disabled = false;
    }
});

// Copy text
copyButton.addEventListener("click", async function () {
    const text = textOutput.value;

    if (!text.trim()) {
        statusMessage.textContent = "There is no text to copy.";
        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        statusMessage.textContent =
            "Text copied to clipboard.";

    } catch (error) {
        textOutput.select();

        statusMessage.textContent =
            "Please copy the selected text manually.";
    }
});

// Download text file
downloadButton.addEventListener("click", function () {
    const text = textOutput.value;

    if (!text.trim()) {
        statusMessage.textContent =
            "There is no text to download.";
        return;
    }

    const file = new Blob([text], {
        type: "text/plain"
    });

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

// Clear app
clearButton.addEventListener("click", function () {
    imageInput.value = "";
    imagePreview.src = "";
    imagePreview.hidden = true;

    textOutput.value = "";
    selectedImage = null;

    extractButton.disabled = true;

    statusMessage.textContent =
        "Upload an image to get started.";
});
