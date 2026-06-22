using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PasswordManager.Models;

namespace PasswordManager.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Credential> Credentials => Set<Credential>();
        public DbSet<LoginEvent> LoginEvents => Set<LoginEvent>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<Credential>(entity =>
            {
                entity.HasIndex(c => new { c.UserId, c.Title });
                entity.HasOne(c => c.User)
                    .WithMany(u => u.Credentials)
                    .HasForeignKey(c => c.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<LoginEvent>(entity =>
            {
                entity.HasIndex(e => new { e.UserId, e.At });
                entity.HasOne(e => e.User)
                    .WithMany(u => u.LoginEvents)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
