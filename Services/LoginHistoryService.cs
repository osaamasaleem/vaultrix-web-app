using Microsoft.EntityFrameworkCore;
using PasswordManager.Data;
using PasswordManager.Models;

namespace PasswordManager.Services
{
    public interface ILoginHistoryService
    {
        Task AddEventAsync(string userId, string title, string details, string dotClass);
        Task<List<LoginHistoryViewItem>> GetRecentAsync(string userId, int count = 8);
    }

    public class LoginHistoryService : ILoginHistoryService
    {
        private readonly ApplicationDbContext _db;

        public LoginHistoryService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task AddEventAsync(string userId, string title, string details, string dotClass)
        {
            _db.LoginEvents.Add(new LoginEvent
            {
                UserId = userId,
                Title = title,
                Details = details,
                DotClass = dotClass,
                At = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }

        public async Task<List<LoginHistoryViewItem>> GetRecentAsync(string userId, int count = 8)
        {
            var events = await _db.LoginEvents
                .AsNoTracking()
                .Where(e => e.UserId == userId)
                .OrderByDescending(e => e.At)
                .Take(count)
                .ToListAsync();

            var now = DateTime.UtcNow;
            return events.Select(e => new LoginHistoryViewItem
            {
                Title = e.Title,
                Details = e.Details,
                DotClass = e.DotClass,
                RelativeTime = ToRelativeTime(now - e.At)
            }).ToList();
        }

        private static string ToRelativeTime(TimeSpan delta)
        {
            if (delta.TotalSeconds < 60) return "Just now";
            if (delta.TotalMinutes < 60) return $"{(int)delta.TotalMinutes} min ago";
            if (delta.TotalHours < 24) return $"{(int)delta.TotalHours} hr ago";
            if (delta.TotalDays < 7) return $"{(int)delta.TotalDays} days ago";
            return "Earlier";
        }
    }
}
