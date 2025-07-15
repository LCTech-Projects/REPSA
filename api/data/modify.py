import pandas as pd

def merge_csv_files(file1_path, file2_path, output_path):
    # Read the two CSV files
    df1 = pd.read_csv(file1_path)
    df2 = pd.read_csv(file2_path)
    
    # Concatenate the two dataframes horizontally (adding columns)
    combined_df = pd.concat([df1, df2], axis=1)
    
    # Save the combined dataframe to a new CSV file
    combined_df.to_csv(output_path, index=False)
    print(f"Merged file saved as: {output_path}")

# Example usage:
merge_csv_files('owid-energy-data-africa-only-from-1990.csv', 'wb-sustainable-energy-for-all.csv', 'merged-owid-wb-energy-datasets-africa-only-from-1990-processed.csv')
