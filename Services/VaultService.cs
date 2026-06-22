using Microsoft.EntityFrameworkCore;
using PasswordManager.Data;
using PasswordManager.Models;

namespace PasswordManager.Services
{
    public interface IVaultService
    {
        Task<List<VaultItem>> GetVaultItemsAsync(string userId);
        Task AddAsync(string userId, VaultItem input);
        Task<bool> UpdateAsync(string userId, VaultItem input);
        Task<bool> DeleteAsync(string userId, int id);
        Task<(bool Ok, bool IsFavorite)> ToggleFavoriteAsync(string userId, int id);
    }

    public class VaultService : IVaultService
    {
        private readonly ApplicationDbContext _db;

        public VaultService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<List<VaultItem>> GetVaultItemsAsync(string userId)
        {
            var items = await _db.Credentials
                .AsNoTracking()
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.IsFavorite)
                .ThenBy(c => c.Title)
                .ToListAsync();

            return items.Select(c => new VaultItem
            {
                Id = c.Id,
                Title = c.Title,
                WebsiteUrl = c.WebsiteUrl,
                Username = c.Username,
                Password = c.Password,
                Category = c.Category,
                IsFavorite = c.IsFavorite
            }).ToList();
        }

        public async Task AddAsync(string userId, VaultItem input)
        {
            _db.Credentials.Add(new Credential
            {
                UserId = userId,
                Title = input.Title.Trim(),
                WebsiteUrl = input.WebsiteUrl.Trim(),
                Username = input.Username.Trim(),
                Password = input.Password,
                Category = input.Category,
                IsFavorite = input.IsFavorite
            });
            await _db.SaveChangesAsync();
        }

        public async Task<bool> UpdateAsync(string userId, VaultItem input)
        {
            var existing = await _db.Credentials
                .FirstOrDefaultAsync(c => c.Id == input.Id && c.UserId == userId);
            if (existing == null) return false;

            existing.Title = input.Title.Trim();
            existing.WebsiteUrl = input.WebsiteUrl.Trim();
            existing.Username = input.Username.Trim();
            existing.Password = input.Password;
            existing.Category = input.Category;

            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteAsync(string userId, int id)
        {
            var existing = await _db.Credentials
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);
            if (existing == null) return false;

            _db.Credentials.Remove(existing);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<(bool Ok, bool IsFavorite)> ToggleFavoriteAsync(string userId, int id)
        {
            var existing = await _db.Credentials
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);
            if (existing == null) return (false, false);

            existing.IsFavorite = !existing.IsFavorite;
            await _db.SaveChangesAsync();
            return (true, existing.IsFavorite);
        }


    }
}
