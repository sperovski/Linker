# Build from the repository root:  docker build -f Linker.Api/Dockerfile .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Linker.Domain/Linker.Domain.csproj Linker.Domain/
COPY Linker.Application/Linker.Application.csproj Linker.Application/
COPY Linker.Infrastructure/Linker.Infrastructure.csproj Linker.Infrastructure/
COPY Linker.Api/Linker.Api.csproj Linker.Api/
RUN dotnet restore Linker.Api/Linker.Api.csproj

COPY Linker.Domain/ Linker.Domain/
COPY Linker.Application/ Linker.Application/
COPY Linker.Infrastructure/ Linker.Infrastructure/
COPY Linker.Api/ Linker.Api/
RUN dotnet publish Linker.Api/Linker.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Linker.Api.dll"]
