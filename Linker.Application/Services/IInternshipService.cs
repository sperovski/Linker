using Linker.Application.DTOs.Internships;

namespace Linker.Application.Services;

public interface IInternshipService
{
    Task<InternshipDetailResponse> CreateAsync(int userId, CreateInternshipRequest request, CancellationToken cancellationToken = default);
    Task<InternshipDetailResponse> UpdateAsync(int userId, int internshipId, UpdateInternshipRequest request, CancellationToken cancellationToken = default);
    Task<InternshipDetailResponse> CloseAsync(int userId, int internshipId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<InternshipListItemResponse>> SearchAsync(InternshipSearchRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<InternshipListItemResponse>> GetOwnListingsAsync(int userId, CancellationToken cancellationToken = default);
    Task<InternshipDetailResponse> GetDetailAsync(int internshipId, CancellationToken cancellationToken = default);
}
