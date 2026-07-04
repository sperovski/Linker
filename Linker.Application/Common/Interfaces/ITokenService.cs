using Linker.Domain.Entities;

namespace Linker.Application.Common.Interfaces;

public interface ITokenService
{
    string CreateToken(User user);
}
