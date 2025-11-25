let embedder = null;

// Function to check if transformers is loaded
function waitForTransformers() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.transformers) {
                resolve();
            } else {
                setTimeout(check, 100);  // Check every 100ms
            }
        };
        check();
    });
}

async function loadEmbedder() {
    // Wait for transformers to be ready
    await waitForTransformers();

    if (!embedder) {
        embedder = await window.transformers.pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2"
        );
    }
    return embedder;
}

// Rest of your code remains the same...
function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function aiSearch(searchText, chosenCategory) {
    const embed = await loadEmbedder();

    const searchVec = (await embed(searchText, {
        pooling: "mean",
        normalize: true
    }))[0];

    const results = [];

    for (let p of PRODUCTS_FROM_DB) {
        const tagText = (p.tags || []).join(" ");
        const tagVec = (await embed(tagText, {
            pooling: "mean",
            normalize: true
        }))[0];
        const sim = cosineSim(searchVec, tagVec);
        const catBoost = p.category.toLowerCase() === chosenCategory.toLowerCase() ? 2 : 1;
        results.push({ id: p.id, score: sim * catBoost });
    }

    results.sort((a, b) => b.score - a.score);
    return results.map(r => r.id);
}

// Example: Call aiSearch when ready (e.g., on button click or page load)
// document.addEventListener('DOMContentLoaded', async () => {
//     const results = await aiSearch("search query", "category");
//     console.log(results);
// });



const firebaseConfig = {
  apiKey: "AIzaSyCA_H8mTHSPGKZxmadwDAHZfEcS3pqvLMY",
  authDomain: "swadeshi-84d03.firebaseapp.com",
  databaseURL: "https://swadeshi-84d03-default-rtdb.firebaseio.com",
  projectId: "swadeshi-84d03",
  storageBucket: "swadeshi-84d03.firebasestorage.app",
  messagingSenderId: "1047926315874",
  appId: "1:1047926315874:web:1a20eca775794903aaaa3b"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// URL ID
const params = new URLSearchParams(window.location.search);
let productId = params.get("id"); // default
let PRODUCTS_FROM_DB = {};


// ELEMENTS
const mainImage = document.getElementById("mainImage");
const thumbContainer = document.getElementById("thumbContainer");
const titleBox = document.getElementById("title");
const priceBox = document.getElementById("price");
const descBox = document.getElementById("description");
const catBox = document.getElementById("category");
const relatedBox = document.getElementById("relatedProducts");

/* LOAD PRODUCT */
let currentIndex = 0;
let allImages = [];

function smartLocalSearch(query, products) {
    const productList = Object.entries(products).map(([id, p]) => ({
        id,
        ...p
    }));

    const q = query.toLowerCase().trim();
    const words = q.split(" ").filter(Boolean);

    return productList
        .map(p => {
            const cat = (p.category || "").toLowerCase();
            const title = (p.title || "").toLowerCase();
            const desc = (p.description || "").toLowerCase();
            const tags = (p.tags || []).map(t => t.toLowerCase());

            // 1️⃣ TAG strict matching: every search word must be found in some tag
            const tagMatch = words.every(w =>
                tags.some(tag => tag.includes(w))
            );

            // 2️⃣ Category match (priority boost)
            const categoryMatch = cat.includes(q);

            // 3️⃣ Title/Desc fallback
            const textMatch =
                title.includes(q) ||
                desc.includes(q);

            // 4️⃣ Decide if product qualifies
            const qualifies = tagMatch || categoryMatch || textMatch;

            if (!qualifies) return null;

            // 5️⃣ Calculate score → higher score = better match
            let score = 0;
            if (categoryMatch) score += 3;
            if (tagMatch) score += 5;
            if (textMatch) score += 2;

            return { ...p, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)  // best results at top
        .map(p => p.id);
}


let data={};

/* LOAD PRODUCT */
async function loadProduct() {
    const snap = await db.ref("products/" + productId).get();
    data = snap.val();

    if (!data) {
        titleBox.innerText = "Product Not Found!";
        return;
    }

    // BASIC FIELDS
    titleBox.innerText = data.title;
    priceBox.innerText = "₹" + data.price;
    descBox.innerText = data.description;
    catBox.innerText = data.category;

    // ⭐ OLD PRICE
    const oldPriceSpan = document.querySelector(".pr-old-price");
    if (data.originalPrice) {
        oldPriceSpan.innerText = "₹" + data.originalPrice;
    }

    // ⭐ DISCOUNT AUTO
    const discountSpan = document.querySelector(".pr-discount");
    if (data.originalPrice) {
        const discount = Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100);
        discountSpan.innerText = discount + "% OFF";
    }

    // ⭐ RATING + STARS (perfect match)
    const ratingSpan = document.querySelector(".pr-stars");
    const ratingCountSpan = document.querySelector(".pr-rating-count");

    const rating = parseFloat(data.rating) || 0;
    const rounded = Math.floor(rating);

    // Stars generate (⭐⭐⭐⭐⭐ format)
    let stars = "";
    for (let i = 1; i <= 5; i++) {
        stars += i <= rounded ? "⭐" : "☆";
    }

    ratingSpan.innerText = stars;

    // Show numeric rating count if available
    ratingCountSpan.innerText = data.rating ? `${data.rating} Rating` : "";
    
    const stock = document.querySelector(".pr-stock");
    
//productDisplay.style.display = "block";

if (!("inStock" in data)) {
  try {
    if (!productId) throw new Error("productId missing from URL");
    await db.ref(`products/${productId}/inStock`).set(true);
    data.inStock = true;
  } catch (err) {
    console.error("Failed to set inStock default:", err);
    // fallback: assume true so UI doesn't break
    data.inStock = true;
  }
}

stock.innerText=data.inStock ? "In Stock" : "Not in Stock";
    
    
    // ⭐ IMAGES
    allImages = data.media || [];
    mainImage.src = allImages[0];

    thumbContainer.innerHTML = "";
    allImages.forEach((img, index) => {
        const div = document.createElement("div");
        div.className = "thumb";
        div.innerHTML = `<img src="${img}">`;

        div.onclick = () => {
            mainImage.src = img;
            openModal(index);
        };

        thumbContainer.appendChild(div);
    });

    mainImage.onclick = () => openModal(0);
}


/* RELATED PRODUCTS */
async function loadRelated() {
    const mainSnap = await db.ref("products/" + productId).get();
    const main = mainSnap.val();

    const snap = await db.ref("products").get();
    const all = snap.val();
    PRODUCTS_FROM_DB = all;


    relatedBox.innerHTML = "";

    const mainTags = main.tags || [];
    const mainCategory = main.category;

    let relatedList = [];

    for (let id in all) {
        if (id === productId) continue; // skip same product

        const p = all[id];
        const pTags = p.tags || [];

        // ❌ Category mismatch → skip
        if (p.category !== mainCategory) continue;

        // Tag match %
        let matches = pTags.filter(tag => mainTags.includes(tag)).length;
        let matchPercent = mainTags.length > 0 ? (matches / mainTags.length) * 100 : 0;

        // ❌ Less than 50% match → skip
        if (matchPercent < 50) continue;

        relatedList.push({
            id,
            ...p,
            matchPercent
        });
    }

    // 🎯 Sort by highest tag match %
    relatedList.sort((a, b) => b.matchPercent - a.matchPercent);

    // Render UI
    relatedList.forEach(prod => {
        const card = document.createElement("div");
        card.className = "related-product";

        card.innerHTML = `
            <img src="${prod.media[0]}">
            <div class="related-title">${prod.title}</div>
            <div class="match-score">${Math.floor(prod.matchPercent)}% match</div>
        `;

        card.onclick = () => {
            window.location.href = `product.html?id=${prod.id}`;
        };

        relatedBox.appendChild(card);
    });

    if (relatedList.length === 0) {
        relatedBox.innerHTML = "<p>No related products found</p>";
    }
}

/* MODAL ZOOM */
// function openModal(img) {
//     document.getElementById("zoomModal").style.display = "flex";
//     document.getElementById("zoomedImage").src = img;
// }

// function closeModal() {
//     document.getElementById("zoomModal").style.display = "none";
// }

/* RUN */

async function handleSearchClick() {
    const q = document.getElementById("searchInput").value.trim();
    if (!q) return;

    // Step 1: search run karo
    const ids = await smartLocalSearch(q, PRODUCTS_FROM_DB);

    // Step 2: IDs localStorage me save karo
    localStorage.setItem("searchResults", JSON.stringify(ids));

    // Step 3: search result page open
    window.location.href = "searched_results.html?ids=" + ids.join(",");

}



function openModal(index) {
    currentIndex = index;
    document.getElementById("zoomModal").style.display = "flex";
    updateZoomedImage();
}

function updateZoomedImage() {
    document.getElementById("zoomedImage").src = allImages[currentIndex];
}

function closeModal() {
    document.getElementById("zoomModal").style.display = "none";
}

// NEXT IMAGE
function nextImage() {
    currentIndex = (currentIndex + 1) % allImages.length;
    updateZoomedImage();
}

// PREVIOUS IMAGE
function prevImage() {
    currentIndex = (currentIndex - 1 + allImages.length) % allImages.length;
    updateZoomedImage();
}

// SCROLL TO SWITCH IMAGE
document.addEventListener("wheel", (e) => {
    if (document.getElementById("zoomModal").style.display !== "flex") return;

    if (e.deltaY > 0) nextImage();
    else prevImage();
});

loadProduct();
loadRelated();



async function categoryMatch(cat) {
    const ids = await smartLocalSearch(cat, PRODUCTS_FROM_DB);

    localStorage.setItem("searchResults", JSON.stringify(ids));

    window.location.href = "searched_results.html?ids=" + ids.join(",");
}



document.getElementById("addtocart").addEventListener("click", function () {
    let cart = JSON.parse(localStorage.getItem("mycart")) || [];

    if (this.dataset.mode === "add") {
        // ADD
        if (!cart.includes(productId)) {
            cart.push(productId);
            localStorage.setItem("mycart", JSON.stringify(cart));
        }
        this.innerText = "Remove From Cart";
        this.dataset.mode = "remove";

    } else {
        // REMOVE
        cart = cart.filter(id => id !== productId);
        localStorage.setItem("mycart", JSON.stringify(cart));

        this.innerText = "Add To Cart";
        this.dataset.mode = "add";
    }
});

// PAGE LOAD CART SYNC
function syncCartButton() {
    let cart = JSON.parse(localStorage.getItem("mycart")) || [];
    const btn = document.getElementById("addtocart");

    if (cart.includes(productId)) {
        btn.innerText = "Remove From Cart";
        btn.dataset.mode = "remove";
    } else {
        btn.innerText = "Add To Cart";
        btn.dataset.mode = "add";
    }
}

syncCartButton();








