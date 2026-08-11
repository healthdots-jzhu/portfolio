using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Data;
using Portfolio.Api.Filters;
using Portfolio.Api.Services;
using Xunit;

namespace Portfolio.Api.UnitTests
{
    class TestCurrentUserProvider : ICurrentUserProvider
    {
        private readonly Guid _id;
        public TestCurrentUserProvider(Guid id) => _id = id;
        public Guid GetUserId(HttpContext context) => _id;
        public string GetCognitoSub(HttpContext context) => string.Empty;
        public string GetEmail(HttpContext context) => string.Empty;
    }

    public class PortfolioOwnershipFilterTests : IDisposable
    {
        private readonly AppDbContext _db;

        public PortfolioOwnershipFilterTests()
        {
            var opts = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase("testdb-" + Guid.NewGuid())
                .Options;
            _db = new AppDbContext(opts);
        }

        public void Dispose()
        {
            _db?.Dispose();
        }

        private ActionExecutingContext MakeContext(string routeKey, string routeValue)
        {
            var http = new DefaultHttpContext();
            var actionContext = new Microsoft.AspNetCore.Mvc.ActionContext(http, new RouteData(), new ControllerActionDescriptor());
            var routeData = actionContext.RouteData;
            routeData.Values[routeKey] = routeValue;

            var context = new ActionExecutingContext(actionContext, Array.Empty<IFilterMetadata>(), new System.Collections.Generic.Dictionary<string, object>(), new object());
            return context;
        }

        [Fact]
        public async Task Owner_AllowsRequest()
        {
            var ownerId = Guid.NewGuid();
            _db.Portfolios.Add(new Models.Portfolio { Id = "p1", PersonId = "alice", OwnerId = ownerId, IsActive = true });
            await _db.SaveChangesAsync();

            var filter = new PortfolioOwnershipFilter(_db, new TestCurrentUserProvider(ownerId));
            var ctx = MakeContext("personId", "alice");

            var executed = false;
            await filter.OnActionExecutionAsync(ctx, () => { executed = true; return Task.FromResult<ActionExecutedContext?>(null); });

            Assert.False(ctx.Result is Microsoft.AspNetCore.Mvc.NotFoundObjectResult);
        }

        [Fact]
        public async Task NonOwner_ReturnsNotFound()
        {
            var ownerId = Guid.NewGuid();
            var otherId = Guid.NewGuid();
            _db.Portfolios.Add(new Models.Portfolio { Id = "p1", PersonId = "alice", OwnerId = ownerId, IsActive = true });
            await _db.SaveChangesAsync();

            var filter = new PortfolioOwnershipFilter(_db, new TestCurrentUserProvider(otherId));
            var ctx = MakeContext("personId", "alice");

            await filter.OnActionExecutionAsync(ctx, () => Task.FromResult<ActionExecutedContext?>(null));

            Assert.IsType<Microsoft.AspNetCore.Mvc.NotFoundObjectResult>(ctx.Result);
        }
    }
}
