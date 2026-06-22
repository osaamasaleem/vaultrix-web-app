namespace PasswordManager.Models
{
    public class LoginHistoryViewItem
    {
        public string Title { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public string DotClass { get; set; } = "dot-success";
        public string RelativeTime { get; set; } = string.Empty;
    }
}
