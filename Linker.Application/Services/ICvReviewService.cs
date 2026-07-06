using Linker.Application.DTOs.Cv;

namespace Linker.Application.Services;

public interface ICvReviewService
{
    Task<CvReviewResponse> ReviewAsync(int userId, CvReviewRequest request, CancellationToken cancellationToken = default);
}
