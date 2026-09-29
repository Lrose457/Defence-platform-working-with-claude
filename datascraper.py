# ///import pandas as pd

# Define countries and their respective Wikipedia URL paths
from turtle import pd


air_forces = {
    "United States": "List_of_active_United_States_military_aircraft",
    "United Kingdom": "List_of_active_United_Kingdom_military_aircraft",
    "India": "List_of_active_Indian_military_aircraft",
    "Japan": "List_of_active_Japan_Self-Defense_Forces_aircraft"
}

all_fleets = []

for country, path in air_forces.items():
    url = f"https://en.wikipedia.org/wiki/{path}"
    tables = pd.read_html(url)
    
    # Extract the main inventory table (typically index 1 or 2)
    fleet_df = tables[1]
    fleet_df["Country"] = country
    all_fleets.append(fleet_df)

# Combine all national air force tables into one DataFrame
combined_dataset = pd.concat(all_fleets, ignore_index=True)

# Export to CSV
combined_dataset.to_csv("global_airforce_inventories.csv", index=False)
print("Dataset successfully created and saved to global_airforce_inventories.csv") script
# requires-python = ">=3.9"
# dependencies = []
# # Add dependency requirement strings to the array above as needed.
# ///

# TODO: Update the main function to your needs or remove it.


def main() -> None:
    print("Start coding in Python today!")


if __name__ == "__main__":
    main()
