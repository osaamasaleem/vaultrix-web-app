using Microsoft.AspNetCore.Identity;

namespace PasswordManager.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string? EncryptedMekByPassword { get; set; }
        public string? EncryptedMekByRecovery { get; set; }

        public ICollection<Credential> Credentials { get; set; } = new List<Credential>();
        public ICollection<LoginEvent> LoginEvents { get; set; } = new List<LoginEvent>();
    }
}
