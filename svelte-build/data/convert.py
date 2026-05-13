import csv


def hex_to_signed_int(hex_str):
    """Convert a hex string to a signed 32-bit integer."""
    val = int(hex_str, 16)
    return val if val < 0x80000000 else val - 0x100000000


def read_dat_file_to_csv(file_path, csv_output_path):
    data_by_temp = {}

    try:
        # Read and clean lines
        with open(file_path, 'r') as f:
            lines = [line.strip() for line in f.readlines()]

        # Ensure even number of lines
        if len(lines) % 2 != 0:
            lines.pop()

        # Process in pairs of lines
        for j in range(0, len(lines), 2):
            csv_row_x = lines[j]
            csv_row_y = lines[j + 1]

            if not csv_row_x or not csv_row_y:
                break

            csv_data_x = csv_row_x.split(';')
            csv_data_y = csv_row_y.split(';')

            try:
                oat = (int(csv_data_x[0], 16) - 24328) / 1200
            except ValueError:
                print(f"Skipping invalid line pair at index {j}")
                continue

            if oat not in data_by_temp:
                data_by_temp[oat] = []

            row_data = []
            for i in range(1, min(len(csv_data_x), len(csv_data_y))):
                try:
                    encrypted_x = csv_data_x[i]
                    encrypted_y = csv_data_y[i]
                    signed_x = hex_to_signed_int(encrypted_x)
                    decrypted_x = (signed_x - 24328) / 1200

                    signed_y =hex_to_signed_int(encrypted_y)
                    decrypted_y = (signed_y - 24328) / 1200
                    
                    #decrypted_x = (int(encrypted_x, 16) - 24328) / 1200
                    #decrypted_y = (int(encrypted_y, 16) - 24328) / 1200
                    row_data.append({
                        'masse': decrypted_x,
                        'pa': decrypted_y,
                        'masse_encrypted': encrypted_x,
                        'pa_encrypted': encrypted_y
                    })
                except ValueError:
                    print(f"Skipping invalid data at line {j}, index {i}")
                    continue

            data_by_temp[oat].append(row_data)

        # Save to CSV
        with open(csv_output_path, 'w', newline='') as csvfile:
            fieldnames = [
                'OAT', 'RowIndex', 'Index',
                'masse', 'pa',
                'masse_encrypted', 'pa_encrypted'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()

            for oat, rows in sorted(data_by_temp.items()):
                for row_index, row in enumerate(rows):
                    for index, point in enumerate(row):
                        writer.writerow({
                            'OAT': oat,
                            'RowIndex': row_index,
                            'Index': index,
                            'masse': point['masse'],
                            'pa': point['pa'],
                            'masse_encrypted': point['masse_encrypted'],
                            'pa_encrypted': point['pa_encrypted']
                        })

        print(f"CSV successfully saved to '{csv_output_path}'")

    except Exception as e:
        print(f"Error reading file: {e}")

    return data_by_temp

# === MAIN FUNCTION ===
if __name__ == "__main__":
    # Replace these with your actual input/output file paths
    input_path = "9-172_-_RATE_OF_CLIMB_OEI_LOW_80KT_ECS_OFF_AI_OFF_0.dat"
    output_csv_path = "output2.csv"

    read_dat_file_to_csv(input_path, output_csv_path)
