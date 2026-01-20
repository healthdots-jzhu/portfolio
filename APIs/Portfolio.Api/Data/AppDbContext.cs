using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Models;

namespace Portfolio.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Portfolio.Api.Models.Portfolio> Portfolios => Set<Portfolio.Api.Models.Portfolio>();
    public DbSet<PortfolioLocale> PortfolioLocales => Set<PortfolioLocale>();
    public DbSet<PortfolioAsset> PortfolioAssets => Set<PortfolioAsset>();
    public DbSet<PortfolioVersion> PortfolioVersions => Set<PortfolioVersion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Subject).IsUnique();
            entity.HasIndex(u => new { u.Subject, u.Issuer }).IsUnique();
            entity.HasIndex(u => u.Email);
        });

        modelBuilder.Entity<Portfolio.Api.Models.Portfolio>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.SequentialId).ValueGeneratedOnAdd();
            entity.HasIndex(p => p.SequentialId).IsUnique();
            entity.HasIndex(p => p.PersonId).IsUnique();
            entity.HasIndex(p => p.Subdomain).IsUnique();
            entity.Property(p => p.Id)
                  .HasMaxLength(6)
                  .ValueGeneratedNever();
            entity.Property(p => p.PersonId).IsRequired();
            entity.Property(p => p.DisplayName).IsRequired();
            entity.HasOne(p => p.Owner)
                  .WithMany(u => u.Portfolios)
                  .HasForeignKey(p => p.OwnerId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PortfolioLocale>(entity =>
        {
            entity.HasIndex(l => new { l.PortfolioId, l.Language }).IsUnique();
            entity.Property(l => l.ContentJson).HasColumnType("json");
        });

        modelBuilder.Entity<PortfolioAsset>(entity =>
        {
            entity.HasIndex(a => new { a.PortfolioId, a.AssetKey }).IsUnique();
        });

        modelBuilder.Entity<PortfolioVersion>(entity =>
        {
            entity.HasIndex(v => new { v.PortfolioId, v.VersionNumber }).IsUnique();
            entity.HasIndex(v => new { v.PortfolioId, v.Status });
            entity.HasIndex(v => new { v.PortfolioId, v.IsCurrentPublished });
            entity.Property(v => v.LocaleSnapshot).HasColumnType("json");
            entity.Property(v => v.Status)
                  .HasConversion<int>()
                  .HasColumnType("integer");
            entity.HasOne(v => v.Portfolio)
                  .WithMany()
                  .HasForeignKey(v => v.PortfolioId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(v => v.Creator)
                  .WithMany()
                  .HasForeignKey(v => v.CreatedBy)
                  .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
