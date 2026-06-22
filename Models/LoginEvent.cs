namespace PasswordManager.Models
{
    public class LoginEvent
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public string DotClass { get; set; } = "dot-success";
        public DateTime At { get; set; } = DateTime.UtcNow;
    }
}
