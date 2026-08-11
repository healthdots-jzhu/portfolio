using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Data;
using Portfolio.Api.Services;

namespace Portfolio.Api.Filters
{
    /// <summary>
    /// Global filter that validates the authenticated user owns the portfolio referenced
    /// by common route parameters such as `portfolioId` or `personId`.
    /// - Skips checks for endpoints marked with [AllowAnonymous].
    /// - If the caller is unauthenticated, the filter does nothing (authorization middleware will handle it).
    /// - If the caller is authenticated and does not own the referenced portfolio, returns 404.
    /// </summary>
    public class PortfolioOwnershipFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _context;
        private readonly ICurrentUserProvider _currentUser;

        public PortfolioOwnershipFilter(AppDbContext context, ICurrentUserProvider currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // If endpoint allows anonymous access, skip ownership validation.
            var endpoint = context.HttpContext.GetEndpoint();
            if (endpoint?.Metadata?.GetMetadata<Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute>() != null)
            {
                await next();
                return;
            }

            var userId = _currentUser.GetUserId(context.HttpContext);
            if (userId == Guid.Empty)
            {
                // Not authenticated; let authorization middleware handle this.
                await next();
                return;
            }

            // Common route param names that reference a portfolio
            // portfolioId -> matches `Portfolios.Id` (primary id)
            // personId -> matches `Portfolios.PersonId` (natural key used for public routes)
            if (context.RouteData.Values.TryGetValue("portfolioId", out var rawPortfolio) && rawPortfolio != null)
            {
                var portfolioId = rawPortfolio.ToString();
                if (!string.IsNullOrWhiteSpace(portfolioId))
                {
                    var owns = await _context.Portfolios.AnyAsync(p => p.Id == portfolioId && p.OwnerId == userId && p.IsActive);
                    if (!owns)
                    {
                        context.Result = new NotFoundObjectResult(new { error = "Portfolio not found or access denied" });
                        return;
                    }
                }
            }
            else if (context.RouteData.Values.TryGetValue("personId", out var rawPerson) && rawPerson != null)
            {
                var personId = rawPerson.ToString();
                if (!string.IsNullOrWhiteSpace(personId))
                {
                    var owns = await _context.Portfolios.AnyAsync(p => p.PersonId == personId && p.OwnerId == userId && p.IsActive);
                    if (!owns)
                    {
                        context.Result = new NotFoundObjectResult(new { error = "Portfolio not found or access denied" });
                        return;
                    }
                }
            }

            await next();
        }
    }
}
