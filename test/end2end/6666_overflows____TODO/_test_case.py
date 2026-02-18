import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))



class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

    # def test_subpixel_accumulation(self):
    #     self.helper.open_case(path_to_this_test_file_folder, 'subpixel_accumulation')
    #     # self.helper.assert_element_starts_page(el, 10)
