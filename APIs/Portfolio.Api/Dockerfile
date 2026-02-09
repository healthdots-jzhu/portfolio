FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# restore dependencies
COPY ./Portfolio.Api.csproj ./
RUN dotnet restore "./Portfolio.Api.csproj"

# copy everything else and build
COPY . ./
RUN dotnet publish "Portfolio.Api.csproj" -c Release -o /app/publish /p:PublishTrimmed=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:80

COPY --from=build /app/publish ./

EXPOSE 80

ENTRYPOINT ["dotnet", "Portfolio.Api.dll"]
