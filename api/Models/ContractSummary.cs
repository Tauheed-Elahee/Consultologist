namespace Api.Models;

public class ContractSummary
{
    public List<ContractItem> Items { get; set; } = [];
    public decimal? TotalMonthly { get; set; }
}

public class ContractItem
{
    public string PlanName { get; set; } = "";
    public decimal? Percentage { get; set; }
    public decimal? Fte { get; set; }
    public decimal? BasePrice { get; set; }
    public decimal? AdjustedMonthly { get; set; }
}
