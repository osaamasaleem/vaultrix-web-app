(function () {
  var currentVaultView = "all";
  var masterKey = null;

  function qs(id) {
    return document.getElementById(id);
  }

  // --- Zxcvbn Integration ---
  function setupStrengthMeter(inputId, meterId, textId) {
      var input = qs(inputId);
      var meter = qs(meterId);
      var text = qs(textId);
      if (!input || !meter || !text || typeof zxcvbn !== "function") return;

      input.addEventListener("input", function() {
          var val = input.value;
          if (!val) {
              meter.style.width = "0%";
              meter.className = "progress-bar bg-danger";
              text.textContent = "";
              return;
          }
          var result = zxcvbn(val);
          var score = result.score;
          var pct = (score + 1) * 20;
          meter.style.width = pct + "%";
          
          var colors = ["bg-danger", "bg-danger", "bg-warning", "bg-info", "bg-success"];
          var labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
          meter.className = "progress-bar " + colors[score];
          var txt = labels[score];
          if (result.feedback.warning) txt += " - " + result.feedback.warning;
          text.textContent = txt;
          text.className = "small mt-1 fw-semibold text-end text-" + colors[score].replace('bg-','');
      });
  }

  // --- Auto Lock ---
  function initAutoLock() {
    var timeoutDuration = 5 * 60 * 1000; // 5 minutes
    var timeoutTimer;
    
    function lockVault() {
      sessionStorage.removeItem("vault_master_key");
      var form = document.createElement("form");
      form.method = "POST";
      form.action = "/Account/Logout";
      var token = document.querySelector('input[name="__RequestVerificationToken"]');
      if (token) form.appendChild(token.cloneNode());
      document.body.appendChild(form);
      form.submit();
    }

    function resetTimer() {
      clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(lockVault, timeoutDuration);
    }

    ['mousemove', 'mousedown', 'keypress', 'touchmove', 'scroll'].forEach(function(evt) {
      document.addEventListener(evt, resetTimer, true);
    });
    resetTimer();
  }

  // --- ZKA Encryption / Decryption ---
  async function initZKA() {
    var b64Kek = sessionStorage.getItem("vault_master_key");
    if (!b64Kek) {
        showToast("Missing decryption key. Forcing logout...", "danger");
        var logoutForm = document.querySelector('form[action*="/Account/Logout"]');
        if (logoutForm) logoutForm.submit();
        return;
    }
    
    var encryptedMekStr = qs("encryptedMekData")?.value;
    if (!encryptedMekStr) {
        showToast("Account missing Encryption Key. Please create a new account.", "danger");
        return;
    }

    try {
        var kek = await window.VaultCrypto.base64ToKey(b64Kek);
        masterKey = await window.VaultCrypto.unwrapMek(encryptedMekStr, kek);
    } catch (e) {
        showToast("Failed to unlock vault. Incorrect key.", "danger");
        return;
    }

    var itemCards = document.querySelectorAll(".vault-item-card");
    for (var i = 0; i < itemCards.length; i++) {
        var card = itemCards[i];
        var editBtn = card.querySelector(".js-edit-btn");
        var passInput = card.querySelector("[id^='pass-']");
        
        if (editBtn && passInput) {
            var encrypted = editBtn.dataset.password;
            var decrypted = await window.VaultCrypto.decrypt(masterKey, encrypted);
            editBtn.dataset.password = decrypted;
            passInput.value = decrypted;
        }
    }
  }

  function initCryptoForms() {
    var addForm = document.querySelector("#addPasswordModal form");
    var editForm = document.querySelector("#editPasswordModal form");

    async function handleForm(e) {
        if (!masterKey) {
            e.preventDefault();
            showToast("Vault is locked. Cannot encrypt.", "danger");
            return;
        }
        var passInput = e.target.querySelector("input[name='Password']");
        if (passInput && passInput.value) {
            e.preventDefault();
            var btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            var origText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Encrypting...';
            
            try {
                var ciphertext = await window.VaultCrypto.encrypt(masterKey, passInput.value);
                passInput.value = ciphertext;
                e.target.submit();
            } catch (err) {
                console.error("Encryption failed", err);
                btn.innerHTML = origText;
                btn.disabled = false;
                showToast("Encryption failed", "danger");
            }
        }
    }

    if (addForm) addForm.addEventListener("submit", handleForm);
    if (editForm) editForm.addEventListener("submit", handleForm);
  }

  // --- Existing Logic ---
  function initPasswordVisibilityToggles() {
    document.querySelectorAll("[data-toggle-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = this.dataset.toggleId;
        var input = document.getElementById("pass-" + id);
        var icon = document.getElementById("eye-" + id);
        if (!input || !icon) return;
        if (input.type === "password") {
          input.type = "text";
          icon.classList.replace("bi-eye", "bi-eye-slash");
        } else {
          input.type = "password";
          icon.classList.replace("bi-eye-slash", "bi-eye");
        }
      });
    });

    var editEyeBtn = qs("editEyeBtn");
    if (editEyeBtn) {
      editEyeBtn.addEventListener("click", function () {
        var input = qs("editPassword");
        var icon = qs("editEyeIcon");
        if (!input || !icon) return;
        if (input.type === "password") {
          input.type = "text";
          icon.classList.replace("bi-eye", "bi-eye-slash");
        } else {
          input.type = "password";
          icon.classList.replace("bi-eye-slash", "bi-eye");
        }
      });
    }
  }

  function filterVault() {
    var search = qs("vaultSearch");
    var cat = qs("categoryFilter");
    if (!search || !cat) return;
    var searchVal = (search.value || "").toLowerCase();
    var catVal = cat.value;

    document.querySelectorAll(".vault-item-card").forEach(function (card) {
      var title = (card.dataset.title || "").toLowerCase();
      var username = (card.dataset.username || "").toLowerCase();
      var category = card.dataset.category || "";
      var isFavorite = (card.dataset.favorite || "false") === "true";

      var matchSearch = title.includes(searchVal) || username.includes(searchVal);
      var matchCat = catVal === "All" || category === catVal;
      var matchView = currentVaultView === "all" || isFavorite;
      card.style.display = matchSearch && matchCat && matchView ? "" : "none";
    });
  }

  function initSidebarViews() {
    document.querySelectorAll(".js-sidebar-view").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        currentVaultView = this.dataset.view || "all";

        document.querySelectorAll(".js-sidebar-view").forEach(function (item) {
          item.classList.remove("active");
        });
        this.classList.add("active");
        filterVault();
      });
    });
  }

  function initSearchFilter() {
    var search = qs("vaultSearch");
    var cat = qs("categoryFilter");
    if (search) search.addEventListener("keyup", filterVault);
    if (cat) cat.addEventListener("change", filterVault);
  }

  function initEditModal() {
    document.querySelectorAll(".js-edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var d = this.dataset;

        var id = qs("editItemId");
        var title = qs("editTitle");
        var url = qs("editUrl");
        var username = qs("editUsername");
        var password = qs("editPassword");
        var category = qs("editCategory");

        if (!id || !title || !url || !username || !password || !category) return;

        id.value = d.id || "";
        title.value = d.title || "";
        url.value = d.url || "";
        username.value = d.username || "";
        password.value = d.password || "";
        category.value = d.category || "Personal";

        password.type = "password";
        var eye = qs("editEyeIcon");
        if (eye) eye.className = "bi bi-eye";
        
        // Trigger zxcvbn evaluation
        var evt = new Event('input', { bubbles: true });
        password.dispatchEvent(evt);

        new bootstrap.Modal(qs("editPasswordModal")).show();
      });
    });
  }

  function initDeleteModal() {
    document.querySelectorAll(".js-delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = qs("deleteItemId");
        var title = qs("deleteItemTitle");
        if (!id || !title) return;

        id.value = this.dataset.id || "";
        title.textContent = this.dataset.title || "";
        new bootstrap.Modal(qs("deleteConfirmModal")).show();
      });
    });
  }

  function showToast(message, type) {
    var existing = qs("vaultToast");
    if (existing) existing.remove();

    var palette = {
      success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", icon: "bi-check-circle-fill" },
      danger: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", icon: "bi-trash3-fill" },
      warning: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", icon: "bi-exclamation-triangle-fill" },
    };
    var c = palette[type] || palette.success;

    var toast = document.createElement("div");
    toast.id = "vaultToast";
    toast.style.cssText =
      "position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;" +
      "background:" +
      c.bg +
      ";border:1px solid " +
      c.border +
      ";color:" +
      c.text +
      ";" +
      "border-radius:8px;padding:0.75rem 1.1rem;" +
      "display:flex;align-items:center;gap:0.6rem;" +
      "font-size:0.875rem;font-weight:500;" +
      "box-shadow:0 4px 16px rgba(0,0,0,0.08);" +
      "animation:vaultSlideIn 0.2s ease;";
    toast.innerHTML = '<i class="bi ' + c.icon + '"></i> ' + message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 3000);
  }

  function initGenerator() {
    var passLen = qs("passLen");
    var lenValue = qs("lenValue");
    var generateBtn = qs("generateBtn");
    var generatedPass = qs("generatedPass");
    var includeNumbers = qs("includeNumbers");
    var includeSymbols = qs("includeSymbols");
    var copyPassBtn = qs("copyPassBtn");

    if (passLen && lenValue) {
      passLen.addEventListener("input", function () {
        lenValue.textContent = this.value;
      });
    }

    if (generateBtn && generatedPass && passLen && includeNumbers && includeSymbols) {
      generateBtn.addEventListener("click", async function () {
        var len = parseInt(passLen.value, 10);
        var nums = includeNumbers.checked;
        var syms = includeSymbols.checked;

        try {
            var response = await fetch(`/Home/GeneratePassword?length=${len}&includeNumbers=${nums}&includeSymbols=${syms}`);
            if (response.ok) {
                var data = await response.json();
                generatedPass.value = data.password;
            } else {
                showToast("Failed to generate password on server.", "danger");
            }
        } catch (e) {
            showToast("Error connecting to server.", "danger");
        }
      });
    }

    if (copyPassBtn && generatedPass) {
      copyPassBtn.addEventListener("click", function () {
        var val = generatedPass.value;
        if (!val || val.includes("Configure")) return;
        navigator.clipboard.writeText(val).then(function () {
          showToast("Password copied to clipboard.", "success");
        });
      });
    }
  }

  function initServerToasts() {
    var msg = document.body.getAttribute("data-toast-message");
    var type = document.body.getAttribute("data-toast-type") || "success";
    if (msg) showToast(msg, type);
  }

  function initSettings() {
    var cpForm = qs("changePasswordForm");
    if (cpForm) {
      cpForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        var btn = qs("cpSubmitBtn");
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...'; }

        var curPass = qs("cpCurrentPassword").value;
        var newPass = qs("cpNewPassword").value;
        var confPass = qs("cpConfirmPassword").value;

        if (newPass !== confPass) {
          showToast("New passwords do not match.", "danger");
          if (btn) { btn.disabled = false; btn.innerHTML = 'Update Password'; }
          return;
        }

        try {
          var encryptedMekStr = qs("encryptedMekData").value;
          var emailEl = document.querySelector(".bi-person-circle");
          var email = emailEl ? emailEl.parentElement.textContent.trim() : "";

          if (!email) throw new Error("Could not determine user email for key derivation.");

          var oldKek = await window.VaultCrypto.deriveKey(curPass, email);
          var mek;
          try {
            mek = await window.VaultCrypto.unwrapMek(encryptedMekStr, oldKek);
          } catch(err) {
            throw new Error("Incorrect current password.");
          }

          var newKek = await window.VaultCrypto.deriveKey(newPass, email);
          var newWrappedMek = await window.VaultCrypto.wrapMek(mek, newKek);
          var b64NewKek = await window.VaultCrypto.keyToBase64(newKek);

          var formData = new FormData();
          formData.append("CurrentPassword", curPass);
          formData.append("NewPassword", newPass);
          formData.append("EncryptedMekByPassword", newWrappedMek);
          var token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
          if (token) formData.append("__RequestVerificationToken", token);

          var response = await fetch('/Account/ChangePassword', {
              method: 'POST',
              body: formData
          });

          if (!response.ok) {
              var errorText = await response.text();
              throw new Error(errorText || "Server error updating password.");
          }

          sessionStorage.setItem("vault_master_key", b64NewKek);
          qs("encryptedMekData").value = newWrappedMek;

          showToast("Master password updated successfully!", "success");
          cpForm.reset();
          var modalEl = document.getElementById('settingsModal');
          if (modalEl) {
              var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
              modal.hide();
          }

        } catch (err) {
          showToast(err.message, "danger");
        } finally {
          if (btn) { btn.disabled = false; btn.innerHTML = 'Update Password'; }
        }
      });
    }

    var exportBtn = qs("exportVaultBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", async function() {
        var passInput = qs("exportPasswordInput").value;
        if (!passInput) {
            showToast("Please enter your Master Password to export.", "warning");
            return;
        }

        try {
            var encryptedMekStr = qs("encryptedMekData").value;
            var emailEl = document.querySelector(".bi-person-circle");
            var email = emailEl ? emailEl.parentElement.textContent.trim() : "";
            
            var testKek = await window.VaultCrypto.deriveKey(passInput, email);
            await window.VaultCrypto.unwrapMek(encryptedMekStr, testKek); // Will throw if incorrect
            
            var csvContent = "data:text/csv;charset=utf-8,Title,WebsiteUrl,Username,Password,Category\n";
            var cards = document.querySelectorAll(".vault-item-card");
            cards.forEach(function(card) {
              var btn = card.querySelector(".js-edit-btn");
              if (btn) {
                var title = btn.dataset.title.replace(/"/g, '""');
                var url = btn.dataset.url.replace(/"/g, '""');
                var user = btn.dataset.username.replace(/"/g, '""');
                var pass = btn.dataset.password.replace(/"/g, '""');
                var cat = btn.dataset.category.replace(/"/g, '""');
                csvContent += `"${title}","${url}","${user}","${pass}","${cat}"\n`;
              }
            });
            
            var encodedUri = encodeURI(csvContent);
            var link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "vaultrix_export.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            qs("exportPasswordInput").value = "";
            showToast("Export successful.", "success");
        } catch (err) {
            showToast("Incorrect Master Password.", "danger");
        }
      });
    }
  }

  async function init() {
    if (!qs("vaultSearch")) return;
    
    initServerToasts();

    if (window.VaultCrypto) {
        await initZKA();
        initCryptoForms();
        initAutoLock();
    }

    setupStrengthMeter("addPasswordInput", "addStrengthMeter", "addStrengthText");
    setupStrengthMeter("editPassword", "editStrengthMeter", "editStrengthText");

    initPasswordVisibilityToggles();
    initSidebarViews();
    initSearchFilter();
    initEditModal();
    initDeleteModal();
    initGenerator();
    initSettings();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
