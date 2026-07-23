import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityRatingSummary } from "@/components/detail/community-rating-summary";

describe("CommunityRatingSummary", () => {
  it("shows the average to one decimal and a pluralised count", () => {
    render(<CommunityRatingSummary average={4.6} count={12} />);
    expect(screen.getByText("4.6")).toBeInTheDocument();
    expect(screen.getByText("from 12 reviews")).toBeInTheDocument();
    expect(screen.getByText(/community rating/i)).toBeInTheDocument();
  });

  it("uses the singular for a single review", () => {
    render(<CommunityRatingSummary average={5} count={1} />);
    expect(screen.getByText("5.0")).toBeInTheDocument();
    expect(screen.getByText("from 1 review")).toBeInTheDocument();
  });

  it("renders nothing when there are no community reviews", () => {
    const { container } = render(
      <CommunityRatingSummary average={0} count={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
