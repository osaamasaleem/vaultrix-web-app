using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PasswordManager.Models;
using PasswordManager.Services;

namespace PasswordManager.Controllers
{
    public class AccountController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly ILoginHistoryService _loginHistoryService;

        public AccountController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            ILoginHistoryService loginHistoryService)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _loginHistoryService = loginHistoryService;
        }

        [HttpGet]
        public IActionResult Login()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Dashboard", "Home");
            }
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(string Email, string Password, bool RememberMe = false)
        {
            if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
            {
                TempData["ToastMessage"] = "Please enter your email and master password.";
                TempData["ToastType"] = "warning";
                return RedirectToAction(nameof(Login));
            }

            var user = await _userManager.FindByEmailAsync(Email.Trim());
            if (user == null)
            {
                TempData["ToastMessage"] = "Invalid email or password.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Login));
            }

            var result = await _signInManager.PasswordSignInAsync(
                user.UserName!,
                Password,
                RememberMe,
                lockoutOnFailure: false);

            if (!result.Succeeded)
            {
                TempData["ToastMessage"] = "Invalid email or password.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Login));
            }

            await _loginHistoryService.AddEventAsync(user.Id, "Vault Unlocked", "Signed in successfully.", "dot-success");

            TempData["ToastMessage"] = "Vault unlocked.";
            TempData["ToastType"] = "success";
            return RedirectToAction("Dashboard", "Home");
        }

        [HttpGet]
        public IActionResult Register()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Dashboard", "Home");
            }
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register(string Email, string Password, string ConfirmPassword, string EncryptedMekByPassword, string EncryptedMekByRecovery)
        {
            if (string.IsNullOrWhiteSpace(Email) ||
                string.IsNullOrWhiteSpace(Password) ||
                string.IsNullOrWhiteSpace(ConfirmPassword))
            {
                TempData["ToastMessage"] = "Please fill in all fields.";
                TempData["ToastType"] = "warning";
                return RedirectToAction(nameof(Register));
            }

            if (!string.Equals(Password, ConfirmPassword, StringComparison.Ordinal))
            {
                TempData["ToastMessage"] = "Passwords do not match.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Register));
            }

            var existing = await _userManager.FindByEmailAsync(Email.Trim());
            if (existing != null)
            {
                TempData["ToastMessage"] = "An account with this email already exists.";
                TempData["ToastType"] = "warning";
                return RedirectToAction(nameof(Register));
            }

            var user = new ApplicationUser
            {
                UserName = Email.Trim(),
                Email = Email.Trim(),
                EmailConfirmed = true,
                EncryptedMekByPassword = EncryptedMekByPassword,
                EncryptedMekByRecovery = EncryptedMekByRecovery
            };

            IdentityResult createResult;
            try
            {
                createResult = await _userManager.CreateAsync(user, Password);
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException)
            {
                // Handles race conditions (e.g. double clicking the register button)
                TempData["ToastMessage"] = "An account with this email already exists.";
                TempData["ToastType"] = "warning";
                return RedirectToAction(nameof(Register));
            }
            if (!createResult.Succeeded)
            {
                var message = string.Join(" ", createResult.Errors.Select(e => e.Description));
                TempData["ToastMessage"] = message;
                TempData["ToastType"] = "warning";
                return RedirectToAction(nameof(Register));
            }

            await _loginHistoryService.AddEventAsync(user.Id, "Vault Created", "Account registered.", "dot-success");

            TempData["ToastMessage"] = "Vault created. Please log in.";
            TempData["ToastType"] = "success";
            return RedirectToAction(nameof(Login));
        }

        [HttpGet]
        public IActionResult Recover()
        {
            if (User.Identity?.IsAuthenticated == true)
                return RedirectToAction("Dashboard", "Home");
            return View();
        }

        [HttpGet]
        public async Task<IActionResult> GetRecoveryData(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return BadRequest();
            var user = await _userManager.FindByEmailAsync(email.Trim());
            if (user == null) return NotFound(); // Returns 404 if user doesn't exist to prevent leakage (though a timing attack could reveal it, acceptable for this scope)
            
            return Json(new { encryptedMekByRecovery = user.EncryptedMekByRecovery });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Recover(string Email, string NewPassword, string EncryptedMekByPassword)
        {
            if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(NewPassword) || string.IsNullOrWhiteSpace(EncryptedMekByPassword))
            {
                TempData["ToastMessage"] = "Invalid request.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Recover));
            }

            var user = await _userManager.FindByEmailAsync(Email.Trim());
            if (user == null)
            {
                TempData["ToastMessage"] = "Invalid request.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Recover));
            }

            var removeResult = await _userManager.RemovePasswordAsync(user);
            if (!removeResult.Succeeded)
            {
                TempData["ToastMessage"] = "Failed to reset password.";
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Recover));
            }

            var addResult = await _userManager.AddPasswordAsync(user, NewPassword);
            if (!addResult.Succeeded)
            {
                TempData["ToastMessage"] = string.Join(" ", addResult.Errors.Select(e => e.Description));
                TempData["ToastType"] = "danger";
                return RedirectToAction(nameof(Recover));
            }

            user.EncryptedMekByPassword = EncryptedMekByPassword;
            await _userManager.UpdateAsync(user);

            await _loginHistoryService.AddEventAsync(user.Id, "Vault Recovered", "Master password reset via recovery code.", "dot-warning");

            TempData["ToastMessage"] = "Vault recovered successfully! Please log in.";
            TempData["ToastType"] = "success";
            return RedirectToAction(nameof(Login));
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ChangePassword(string CurrentPassword, string NewPassword, string EncryptedMekByPassword)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(CurrentPassword) || string.IsNullOrWhiteSpace(NewPassword) || string.IsNullOrWhiteSpace(EncryptedMekByPassword))
                return BadRequest("Invalid request.");

            var changeResult = await _userManager.ChangePasswordAsync(user, CurrentPassword, NewPassword);
            if (!changeResult.Succeeded)
            {
                return BadRequest(string.Join(" ", changeResult.Errors.Select(e => e.Description)));
            }

            user.EncryptedMekByPassword = EncryptedMekByPassword;
            await _userManager.UpdateAsync(user);

            await _loginHistoryService.AddEventAsync(user.Id, "Password Changed", "Master password updated successfully.", "dot-warning");

            // Re-sign in the user so the security stamp is updated
            await _signInManager.RefreshSignInAsync(user);

            return Ok();
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user != null)
            {
                await _loginHistoryService.AddEventAsync(user.Id, "Logged Out", "Session ended.", "dot-warning");
            }

            await _signInManager.SignOutAsync();

            TempData["ToastMessage"] = "Logged out.";
            TempData["ToastType"] = "success";
            return RedirectToAction("Index", "Home");
        }
    }
}
