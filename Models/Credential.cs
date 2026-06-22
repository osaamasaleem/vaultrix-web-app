namespace PasswordManager.Models
{
    public class Credential
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public string WebsiteUrl { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Category { get; set; } = "Personal";
        public bool IsFavorite { get; set; }
    }
}
