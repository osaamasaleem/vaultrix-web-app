using Microsoft.AspNetCore.Mvc;
using PasswordManager.Models;
using System.Collections.Generic;

namespace PasswordManager.Controllers
{
    public class HomeController : Controller
    {
        // Landing Page
        public IActionResult Index()
        {
            return View();
        }

        // Dashboard (The Secure Vault)
        public IActionResult Dashboard()
        {
            // Clean mockup data to make your frontend demo look live and functional next week!
            var mockVault = new List<VaultItem>
            {
                new() { Id = 1, Title = "Google Account", WebsiteUrl = "https://google.com", Username = "user@gmail.com", Password = "SuperSecretPassword123", Category = "Work" },
                new() { Id = 2, Title = "GitHub Portal", WebsiteUrl = "https://github.com", Username = "dev_username", Password = "MyGitSecurePass99!", Category = "Development" },
                new() { Id = 3, Title = "HBL Mobile Banking", WebsiteUrl = "https://hbl.com", Username = "pk_finance_user", Password = "BankPassword$456", Category = "Finance" },
                new() { Id = 4, Title = "Netflix Family", WebsiteUrl = "https://netflix.com", Username = "streamer_99", Password = "PopcornTime2026", Category = "Personal" }
            };

            return View(mockVault);
        }
    }
}