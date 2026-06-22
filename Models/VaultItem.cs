namespace PasswordManager.Models
{
    public class VaultItem
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string WebsiteUrl { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Category { get; set; } = "General";
        public bool IsFavorite { get; set; }
    }
}