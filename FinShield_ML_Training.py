import pandas as pd
import numpy as np

# ============================================================
# STEP 1: LOAD DATASET
# ============================================================

df = pd.read_csv("financial_risk_assessment.csv")

print("\n========== FIRST 5 ROWS ==========")
print(df.head())


# ============================================================
# STEP 2: DATASET SIZE
# ============================================================

print("\n========== DATASET SHAPE ==========")
print(df.shape)


# ============================================================
# STEP 3: COLUMN NAMES
# ============================================================

print("\n========== COLUMNS ==========")
for column in df.columns:
    print(column)


# ============================================================
# STEP 4: DATA TYPES
# ============================================================

print("\n========== DATA TYPES ==========")
print(df.dtypes)


# ============================================================
# STEP 5: MISSING VALUES
# ============================================================

print("\n========== MISSING VALUES ==========")
print(df.isnull().sum())


# ============================================================
# STEP 6: TARGET DISTRIBUTION
# ============================================================

print("\n========== RISK RATING DISTRIBUTION ==========")

print(df["Risk Rating"].value_counts())

print("\nPercentage:")
print(df["Risk Rating"].value_counts(normalize=True) * 100)


# ============================================================
# STEP 7: BASIC STATISTICS
# ============================================================

print("\n========== STATISTICAL SUMMARY ==========")

print(df.describe())