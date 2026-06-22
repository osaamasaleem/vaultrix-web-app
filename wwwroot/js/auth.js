(function () {
  function togglePassword(input, icon) {
    if (!input || !icon) return;
    if (input.type === "password") {
      input.type = "text";
      icon.classList.replace("bi-eye", "bi-eye-slash");
    } else {
      input.type = "password";
      icon.classList.replace("bi-eye-slash", "bi-eye");
    }
  }

  function init() {
    document.querySelectorAll("[data-toggle-password]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetSel = btn.getAttribute("data-target");
        var iconSel = btn.getAttribute("data-icon");
        if (!targetSel || !iconSel) return;
        togglePassword(document.querySelector(targetSel), document.querySelector(iconSel));
      });
    });

    var loginForm = document.querySelector("form[action*='/Account/Login']");
    if (loginForm) {
        loginForm.addEventListener("submit", function(e) {
            e.preventDefault();
            var btn = loginForm.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Securing...';
            }

            var emailInput = loginForm.querySelector("input[name='Email']");
            var passwordInput = loginForm.querySelector("input[name='Password']");
            if (emailInput && passwordInput && window.VaultCrypto) {
                window.VaultCrypto.deriveKey(passwordInput.value, emailInput.value).then(function(key) {
                    window.VaultCrypto.keyToBase64(key).then(function(b64) {
                        sessionStorage.setItem("vault_master_key", b64);
                        loginForm.submit();
                    });
                }).catch(function(err) {
                    console.error("Crypto error", err);
                    loginForm.submit();
                });
            } else {
                loginForm.submit();
            }
        });
    }

    var registerForm = document.querySelector("form[action*='/Account/Register']");
    if (registerForm) {
        registerForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            var btn = registerForm.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating Keys...';
            }

            var emailInput = registerForm.querySelector("input[name='Email']");
            var passwordInput = registerForm.querySelector("input[name='Password']");
            var confInput = registerForm.querySelector("input[name='ConfirmPassword']");
            
            if (passwordInput.value !== confInput.value) {
                if (btn) { btn.disabled = false; btn.innerHTML = 'Create Free Vault'; }
                return registerForm.submit(); // Let server handle validation error
            }

            try {
                var email = emailInput.value;
                var password = passwordInput.value;
                
                // Generate MEK & Recovery Code
                var mek = await window.VaultCrypto.generateMek();
                var recoveryCode = window.VaultCrypto.generateRecoveryCode();
                
                // Derive KEKs
                var kekPassword = await window.VaultCrypto.deriveKey(password, email);
                var kekRecovery = await window.VaultCrypto.deriveKey(recoveryCode, email); // email as salt
                
                // Save kekPassword for immediate dashboard login
                var b64Kek = await window.VaultCrypto.keyToBase64(kekPassword);
                sessionStorage.setItem("vault_master_key", b64Kek);
                
                // Wrap MEK
                var wrappedPassword = await window.VaultCrypto.wrapMek(mek, kekPassword);
                var wrappedRecovery = await window.VaultCrypto.wrapMek(mek, kekRecovery);
                
                // Set hidden fields
                var pInput = document.getElementById('mekByPassword');
                var rInput = document.getElementById('mekByRecovery');
                if(pInput) pInput.value = wrappedPassword;
                if(rInput) rInput.value = wrappedRecovery;
                
                // Show recovery modal
                var displaySpan = document.getElementById('displayRecoveryCode');
                if (displaySpan) displaySpan.innerText = recoveryCode;
                
                var modalEl = document.getElementById('recoveryCodeModal');
                if (modalEl) {
                    var modal = new bootstrap.Modal(modalEl);
                    
                    var confirmBtn = document.getElementById('confirmRecoveryBtn');
                    if (confirmBtn) {
                        confirmBtn.addEventListener('click', function() {
                            modal.hide();
                            registerForm.submit();
                        }, {once: true});
                    }
                    modal.show();
                } else {
                    registerForm.submit();
                }
            } catch (err) {
                console.error("Crypto error", err);
                if (btn) { btn.disabled = false; btn.innerHTML = 'Create Free Vault'; }
                registerForm.submit(); // fallback
            }
        });
    }

    var recoverForm = document.getElementById("recoverForm");
    if (recoverForm) {
        recoverForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            var btn = document.getElementById("submitRecoverBtn");
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verifying...'; }

            var emailInput = document.getElementById("email");
            var codeInput = document.getElementById("recoveryCode");
            var passwordInput = document.getElementById("password");
            var confirmInput = document.getElementById("confirmPassword");
            
            if (passwordInput.value !== confirmInput.value) {
                alert("Passwords do not match!");
                if (btn) { btn.disabled = false; btn.innerHTML = 'Restore Vault Access'; }
                return;
            }

            try {
                var email = emailInput.value.trim();
                var recoveryCode = codeInput.value.trim();
                var newPassword = passwordInput.value;

                // 1. Fetch encrypted MEK from server
                var response = await fetch('/Account/GetRecoveryData?email=' + encodeURIComponent(email));
                if (!response.ok) {
                    throw new Error("User not found or network error.");
                }
                var data = await response.json();
                var encryptedMekByRecovery = data.encryptedMekByRecovery;

                // 2. Unwrap MEK using Recovery Code
                var kekRecovery = await window.VaultCrypto.deriveKey(recoveryCode, email);
                var mek;
                try {
                    mek = await window.VaultCrypto.unwrapMek(encryptedMekByRecovery, kekRecovery);
                } catch (unwrapErr) {
                    throw new Error("Invalid Recovery Code!");
                }

                // 3. Re-wrap MEK with New Password
                var kekNewPassword = await window.VaultCrypto.deriveKey(newPassword, email);
                var newWrappedMek = await window.VaultCrypto.wrapMek(mek, kekNewPassword);

                // 4. Submit form
                document.getElementById("newEncryptedMekByPassword").value = newWrappedMek;
                recoverForm.submit();

            } catch (err) {
                console.error("Recovery error:", err);
                alert(err.message || "Failed to recover vault.");
                if (btn) { btn.disabled = false; btn.innerHTML = 'Restore Vault Access'; }
            }
        });
    }

    var passInput = document.getElementById("password");
    var strengthMeter = document.getElementById("strengthMeter");
    var strengthText = document.getElementById("strengthText");
    if (passInput && strengthMeter && typeof zxcvbn === "function") {
        passInput.addEventListener("input", function() {
            var val = passInput.value;
            if (!val) {
                strengthMeter.style.width = "0%";
                strengthMeter.className = "progress-bar bg-danger";
                strengthText.textContent = "";
                return;
            }
            var result = zxcvbn(val);
            var score = result.score;
            var pct = (score + 1) * 20;
            strengthMeter.style.width = pct + "%";
            
            var colors = ["bg-danger", "bg-danger", "bg-warning", "bg-info", "bg-success"];
            var labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
            strengthMeter.className = "progress-bar " + colors[score];
            var txt = labels[score];
            if (result.feedback.warning) txt += " - " + result.feedback.warning;
            strengthText.textContent = txt;
            strengthText.className = "small mt-1 fw-semibold text-end text-" + colors[score].replace('bg-','');
        });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
