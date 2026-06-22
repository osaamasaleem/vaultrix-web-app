window.VaultCrypto = (function() {
    const iterations = 100000;
    
    // Generates a new random 256-bit AES-GCM MEK
    async function generateMek() {
        return await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true, // extractable
            ["encrypt", "decrypt"]
        );
    }

    // Generates a 16 character alphanumeric recovery code
    function generateRecoveryCode() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I,O,0,1 to avoid confusion
        const arr = new Uint32Array(16);
        window.crypto.getRandomValues(arr);
        let code = "";
        for(let i=0; i<16; i++) {
            code += chars[arr[i] % chars.length];
        }
        return code.match(/.{1,4}/g).join('-'); // ABCD-EFGH-JKLM-NPQR
    }

    // Wrap the MEK using a KEK (derived from password or recovery code)
    async function wrapMek(mek, kek) {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const wrapped = await window.crypto.subtle.wrapKey(
            "raw",
            mek,
            kek,
            { name: "AES-GCM", iv: iv }
        );
        const combined = new Uint8Array(iv.length + wrapped.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(wrapped), iv.length);
        return btoa(String.fromCharCode.apply(null, combined));
    }

    // Unwrap the MEK using a KEK
    async function unwrapMek(wrappedBase64, kek) {
        const binaryStr = atob(wrappedBase64);
        const combined = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) combined[i] = binaryStr.charCodeAt(i);
        
        const iv = combined.slice(0, 12);
        const wrappedData = combined.slice(12);

        return await window.crypto.subtle.unwrapKey(
            "raw",
            wrappedData,
            kek,
            { name: "AES-GCM", iv: iv },
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    async function deriveKey(password, email) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
        );
        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode(email.toLowerCase()),
                iterations: iterations,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true, // extractable so we can export it to sessionStorage
            ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
        );
    }

    async function encrypt(key, plaintext) {
        const enc = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            enc.encode(plaintext)
        );
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(ciphertext), iv.length);
        return btoa(String.fromCharCode.apply(null, combined));
    }

    async function decrypt(key, base64Ciphertext) {
        try {
            const binaryStr = atob(base64Ciphertext);
            const combined = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) combined[i] = binaryStr.charCodeAt(i);
            
            const iv = combined.slice(0, 12);
            const ciphertext = combined.slice(12);
            
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                ciphertext
            );
            const dec = new TextDecoder();
            return dec.decode(decrypted);
        } catch (e) {
            return base64Ciphertext; // Fallback for old plaintext passwords
        }
    }
    
    async function keyToBase64(key) {
        const exported = await window.crypto.subtle.exportKey("raw", key);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(exported)));
    }
    
    async function base64ToKey(base64) {
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        return window.crypto.subtle.importKey(
            "raw", bytes, { name: "AES-GCM" }, true, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
        );
    }

    return { deriveKey, encrypt, decrypt, keyToBase64, base64ToKey, generateMek, generateRecoveryCode, wrapMek, unwrapMek };
})();
