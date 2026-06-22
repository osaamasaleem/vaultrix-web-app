using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PasswordManager.Models;
using PasswordManager.Services;

namespace PasswordManager.Controllers
{
    public class HomeController : Controller
    {
        private readonly IVaultService _vaultService;
        private readonly ILoginHistoryService _loginHistoryService;
        private readonly UserManager<ApplicationUser> _userManager;

        public HomeController(
            IVaultService vaultService,
            ILoginHistoryService loginHistoryService,
            UserManager<ApplicationUser> userManager)
        {
            _vaultService = vaultService;
            _loginHistoryService = loginHistoryService;
            _userManager = userManager;
        }

        public IActionResult Index()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction(nameof(Dashboard));
            }
            return View();
        }

        [Authorize]
        [ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
        public async Task<IActionResult> Dashboard()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return RedirectToAction("Login", "Account");

            var vault = await _vaultService.GetVaultItemsAsync(user.Id);

            ViewData["UserEmail"] = user.Email;
            ViewData["LoginHistory"] = await _loginHistoryService.GetRecentAsync(user.Id);
            ViewData["EncryptedMek"] = user.EncryptedMekByPassword;

            return View(vault);
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(VaultItem input)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return RedirectToAction("Login", "Account");

            var (ok, error) = ValidateVaultInput(input, isEdit: false);
            if (!ok)
            {
                TempData["ToastMessage"] = error;
                TempData["ToastType"] = "warning";
                return RedirectToAction(nameof(Dashboard));
            }

            await _vaultService.AddAsync(user.Id, input);
            await _loginHistoryService.AddEventAsync(user.Id, "Credential Added", input.Title, "dot-success");
            TempData["ToastMessage"] = "Credential added.";
            TempData["ToastType"] = "success";
            return RedirectToAction(nameof(Dashboard));
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(VaultItem input)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return RedirectToAction("Login", "Account");

            var (ok, error) = ValidateVaultInput(input, isEdit: true);
            if (!ok)
            {
                TempData["ToastMessage"] = error;
                TempData["ToastType"] = "warning";
                return RedirectToAction(nameof(Dashboard));
            }

            var updated = await _vaultService.UpdateAsync(user.Id, input);
            if (!updated)
            {
                TempData["ToastMessage"] = "Credential not found.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Dashboard));
            }

            await _loginHistoryService.AddEventAsync(user.Id, "Credential Updated", input.Title, "dot-success");
            TempData["ToastMessage"] = "Credential updated.";
            TempData["ToastType"] = "success";
            return RedirectToAction(nameof(Dashboard));
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return RedirectToAction("Login", "Account");

            var deleted = await _vaultService.DeleteAsync(user.Id, id);
            if (!deleted)
            {
                TempData["ToastMessage"] = "Credential not found.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Dashboard));
            }

            await _loginHistoryService.AddEventAsync(user.Id, "Credential Deleted", $"Id #{id}", "dot-danger");
            TempData["ToastMessage"] = "Credential deleted.";
            TempData["ToastType"] = "danger";
            return RedirectToAction(nameof(Dashboard));
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ToggleFavorite(int id)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return RedirectToAction("Login", "Account");

            var (ok, isFavorite) = await _vaultService.ToggleFavoriteAsync(user.Id, id);
            if (!ok)
            {
                TempData["ToastMessage"] = "Credential not found.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Dashboard));
            }

            await _loginHistoryService.AddEventAsync(
                user.Id,
                isFavorite ? "Favorite Added" : "Favorite Removed",
                $"Id #{id}",
                "dot-success");

            TempData["ToastMessage"] = isFavorite ? "Added to favorites." : "Removed from favorites.";
            TempData["ToastType"] = "success";
            return RedirectToAction(nameof(Dashboard));
        }

        private static (bool Ok, string Error) ValidateVaultInput(VaultItem input, bool isEdit)
        {
            if (isEdit && input.Id <= 0) return (false, "Invalid item id.");
            if (string.IsNullOrWhiteSpace(input.Title)) return (false, "Title is required.");
            if (string.IsNullOrWhiteSpace(input.WebsiteUrl)) return (false, "Website URL is required.");
            if (!Uri.TryCreate(input.WebsiteUrl, UriKind.Absolute, out _)) return (false, "Website URL must be a valid absolute URL.");
            if (string.IsNullOrWhiteSpace(input.Username)) return (false, "Username is required.");
            if (string.IsNullOrWhiteSpace(input.Password)) return (false, "Password is required.");
            if (string.IsNullOrWhiteSpace(input.Category)) input.Category = "Personal";
            return (true, string.Empty);
        }

        [Authorize]
        [HttpGet]
        public IActionResult GeneratePassword(int length = 16, bool includeNumbers = true, bool includeSymbols = true)
        {
            if (length < 8) length = 8;
            if (length > 128) length = 128;

            var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            if (includeNumbers) chars += "0123456789";
            if (includeSymbols) chars += "!@#$%^&*()_+~`|{}[]:;?><,./-=";

            var result = new char[length];
            for (int i = 0; i < length; i++)
            {
                result[i] = chars[RandomNumberGenerator.GetInt32(chars.Length)];
            }

            return Json(new { password = new string(result) });
        }
    }
}
