import os
import numpy as np
import matplotlib.pyplot as plt

def read_dat_file(file_path):
    """
    Lit un fichier .dat et retourne un dictionnaire contenant les courbes par température OAT.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Le fichier {file_path} n'existe pas.")

    data_by_temp = {}

    with open(file_path, 'r') as file:
        lines = file.readlines()

    if len(lines) % 2 != 0:
        raise ValueError("Le fichier ne contient pas un nombre pair de lignes.")

    for j in range(0, len(lines), 2):
        csv_row_x = lines[j].strip()
        csv_row_y = lines[j + 1].strip()

        if not csv_row_x or not csv_row_y:
            continue

        csv_data_x = csv_row_x.split(";")
        csv_data_y = csv_row_y.split(";")

        if len(csv_data_x) != len(csv_data_y):
            raise ValueError("Les lignes X et Y ne contiennent pas le même nombre de colonnes.")

        try:
            # OAT: Premier élément, transformé
            oat = (int(csv_data_x[0], 16) - 24328) / 1200
            curve = []

            for i in range(len(csv_data_x)):
                x = (int(csv_data_x[i], 16) - 24328) / 1200  # Masse
                y = (int(csv_data_y[i], 16) - 24328) / 1200  # PA
                curve.append((x, y))

            if oat not in data_by_temp:
                data_by_temp[oat] = []

            data_by_temp[oat].append(curve)
        except Exception as e:
            print(f"Erreur sur les lignes {j}-{j+1} : {e}")

    return data_by_temp

def plot_curves(data_by_temp):
    """
    Affiche les courbes Masse vs PA pour chaque température OAT.
    """
    plt.figure(figsize=(10, 6))
    
    for oat, curves in sorted(data_by_temp.items()):
        for curve in curves:
            x_vals, y_vals = zip(*curve)
            plt.plot(x_vals, y_vals, label=f'OAT {oat:.1f}°C')

    plt.xlabel('Masse (kg/s)')
    plt.ylabel('PA (bar ou unités équivalentes)')
    plt.title('Courbes Masse vs PA par Température OAT')
    plt.xlim(-40, 50)  # <--- Set x-axis range here
    plt.grid(True)
    plt.legend(loc='best', fontsize='small')
    plt.tight_layout()
    plt.show()

# === MAIN ===
if __name__ == "__main__":
    file_path = "9-130_-_WEIGHT_INDEX_0.dat"  # 🔁 Change to your actual file name
    data = read_dat_file(file_path)
    plot_curves(data)
