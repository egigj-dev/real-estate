import pandas as pd
import re
from datetime import datetime
from extractors import PriceExtractor, AreaExtractor


class DataCleaner:
    """Clean and validate apartment listing data"""
    
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.original_df = df.copy()
        self.price_ex = PriceExtractor()
        self.area_ex = AreaExtractor()
        self.log = []

    def _log_change(self, change_type: str, details: dict):
        """Log any change made to data"""
        self.log.append({'timestamp': datetime.now(), 'type': change_type, **details})

    def standardize_formats(self):
        """Fix inconsistent text formats"""
        if 'furnishing_status' in self.df.columns:
            self.df['furnishing_status'] = self.df['furnishing_status'].str.lower().str.strip()
        
        if 'description' in self.df.columns:
            self.df['description'] = self.df['description'].str.lower().str.strip()
            self.df['description'] = self.df['description'].str.replace(r'\s+', ' ', regex=True)
        
        print("Text formats standardized")
        return self

    def handle_missing(self):
        """Fill missing values"""
        # Infer parking from related features
        if 'has_garage' in self.df.columns:
            self.df.loc[self.df['has_parking_space'].isna() & (self.df['has_garage'] == 1), 'has_parking_space'] = 1
        if 'has_carport' in self.df.columns:
            self.df.loc[self.df['has_parking_space'].isna() & (self.df['has_carport'] == 1), 'has_parking_space'] = 1
        
        # Median imputation for numeric columns
        for col in ['floor', 'bedrooms', 'bathrooms']:
            if col in self.df.columns:
                before_na = self.df[col].isnull().sum()
                self.df[col].fillna(self.df[col].median(), inplace=True)
                if before_na > 0:
                    print(f"  {col}: filled {before_na} missing values")
        
        # Fill binary features with 0
        for col in ['has_elevator', 'has_parking_space', 'has_garage', 'has_carport', 'has_terrace', 'has_garden']:
            if col in self.df.columns:
                self.df[col].fillna(0, inplace=True)
        
        self.df['furnishing_status'].fillna('unknown', inplace=True)
        print("All missing values handled\n")
        return self

    def check_impossible_values(self):
        """Remove logically impossible values"""
        removals = {}
        
        if (self.df['price_eur'] <= 0).any():
            removals['negative_price'] = (self.df['price_eur'] <= 0).sum()
            self.df = self.df[self.df['price_eur'] > 0]
        
        if (self.df['area_sqm'] <= 0).any():
            removals['zero_area'] = (self.df['area_sqm'] <= 0).sum()
            self.df = self.df[self.df['area_sqm'] > 0]
        
        if 'bedrooms' in self.df.columns and (self.df['bedrooms'] < 0).any():
            removals['negative_bedrooms'] = (self.df['bedrooms'] < 0).sum()
            self.df = self.df[self.df['bedrooms'] >= 0]
        
        for issue, count in removals.items():
            print(f"  Removed {count} rows ({issue})")
            self._log_change(f'removed_{issue}', {'count': count})
        
        print()
        return self

    def filter_location(self, lat_range=(41.25, 41.45), lng_range=(19.65, 20.00)):
        """Filter by geographic coordinates"""
        lat_min, lat_max = lat_range
        lng_min, lng_max = lng_range
        before = len(self.df)
        
        self.df = self.df[(self.df['lat'] >= lat_min) & (self.df['lat'] <= lat_max) &
                         (self.df['lng'] >= lng_min) & (self.df['lng'] <= lng_max)]
        
        removed = before - len(self.df)
        print(f"Location filter: removed {removed} listings\n")
        self._log_change('location_filter', {'removed': removed})
        return self

    def extract_areas(self):
        """Fill missing areas from description text"""
        filled = 0
        for idx, row in self.df.iterrows():
            if pd.isna(row['area_sqm']) or row['area_sqm'] <= 0:
                area, _ = self.area_ex.extract_best(row['description'])
                if area:
                    self.df.loc[idx, 'area_sqm'] = area
                    filled += 1
        
        print(f"Filled {filled} missing areas\n")
        self._log_change('areas_extracted', {'count': filled})
        return self

    def extract_prices(self):
        """Fix prices using per-sqm rates from description"""
        fixed = 0
        for idx, row in self.df.iterrows():
            price, ptype = self.price_ex.extract(row['description'])
            if ptype == 'per_sqm' and price and row['area_sqm'] > 0:
                new = price * row['area_sqm']
                old = self.df.loc[idx, 'price_eur']
                if old > 0 and abs(new - old) / old > 0.2:
                    self.df.loc[idx, 'price_eur'] = new
                    fixed += 1
        
        print(f"Fixed {fixed} prices\n")
        self._log_change('prices_extracted', {'count': fixed})
        return self

    def remove_duplicates(self):
        """Hash-based duplicate removal"""
        self.df['_sig'] = (
            self.df['description'].str.lower().apply(lambda x: hash(x) if pd.notna(x) else 0) % 10000 +
            (self.df['price_eur'] // 5000).astype(int) * 100000 +
            (self.df['area_sqm'] // 10).astype(int) * 1000000
        )
        
        to_drop = set()
        for sig, group in self.df.groupby('_sig'):
            if len(group) > 1:
                for i, (idx1, row1) in enumerate(group.iterrows()):
                    for idx2, row2 in group.iloc[i+1:].iterrows():
                        w1 = set(re.findall(r'\b\w{4,}\b', str(row1['description']).lower()))
                        w2 = set(re.findall(r'\b\w{4,}\b', str(row2['description']).lower()))
                        if w1 and w2 and len(w1 & w2) / len(w1 | w2) > 0.8:
                            to_drop.add(max(idx1, idx2))
        
        self.df = self.df.drop(list(to_drop), errors='ignore').drop('_sig', axis=1)
        print(f"Removed {len(to_drop)} duplicates\n")
        self._log_change('duplicates_removed', {'count': len(to_drop)})
        return self

    def remove_outliers(self, std_mult=2.5, method='delete'):
        """Remove/cap/flag outliers using IQR method"""
        self.df['price_per_sqm'] = self.df['price_eur'] / self.df['area_sqm']
        Q1 = self.df['price_per_sqm'].quantile(0.25)
        Q3 = self.df['price_per_sqm'].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - std_mult * IQR
        upper = Q3 + std_mult * IQR
        
        is_outlier = (self.df['price_per_sqm'] < lower) | (self.df['price_per_sqm'] > upper)
        outlier_count = is_outlier.sum()
        
        print(f"Price/sqm bounds: €{lower:.2f} – €{upper:.2f}")
        print(f"Outliers detected: {outlier_count}")
        
        if method == 'delete':
            self.df = self.df[~is_outlier]
            self._log_change('outliers_deleted', {'count': outlier_count})
        elif method == 'cap':
            self.df.loc[self.df['price_per_sqm'] < lower, 'price_per_sqm'] = lower
            self.df.loc[self.df['price_per_sqm'] > upper, 'price_per_sqm'] = upper
            self.df['price_eur'] = self.df['price_per_sqm'] * self.df['area_sqm']
            self._log_change('outliers_capped', {'count': outlier_count})
        elif method == 'flag':
            self.df['is_outlier'] = is_outlier
            self._log_change('outliers_flagged', {'count': outlier_count})
        
        print()
        return self

    def validate_ranges(self, area=(15, 300), price=(10000, 2000000)):
        """Remove out-of-range listings"""
        before = len(self.df)
        self.df = self.df[(self.df['area_sqm'] >= area[0]) & (self.df['area_sqm'] <= area[1]) &
                         (self.df['price_eur'] >= price[0]) & (self.df['price_eur'] <= price[1])]
        removed = before - len(self.df)
        
        print(f"Area: {area[0]}–{area[1]} m² | Price: €{price[0]:,}–€{price[1]:,}")
        print(f"Removed {removed} out-of-range listings\n")
        self._log_change('range_validation', {'removed': removed})
        return self

    def finalize(self):
        """Final cleanup and summary"""
        self.df = self.df[self.df['area_sqm'] > 0]
        self.df['price_per_sqm'] = self.df['price_eur'] / self.df['area_sqm']
        self.df = self.df.drop([c for c in ['price_currency', 'description'] if c in self.df.columns], axis=1, errors='ignore')
        
        print(f"\n{'FINAL STATISTICS':}\n")
        print(self.df[['price_eur', 'area_sqm', 'price_per_sqm']].describe())
        
        missing = self.df.isnull().sum()
        missing = missing[missing > 0]
        print(f"\nMissing values: {len(missing)} columns | Total rows: {len(self.df):,}\n")
        
        return self.df

    def save_results(self, data_file='apartments_cleaned.csv', log_file='cleaning_log.csv'):
        """Save cleaned data and audit log"""
        self.df.to_csv(data_file, index=False)
        pd.DataFrame(self.log).to_csv(log_file, index=False)
        print(f"Saved to {data_file} and {log_file}")

    def get_log(self):
        """Return detailed change log"""
        return pd.DataFrame(self.log)